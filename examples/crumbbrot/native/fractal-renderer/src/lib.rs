use napi::{
    Env, Error, Result, Status, Task,
    bindgen_prelude::{AsyncTask, Buffer},
};
use napi_derive::napi;
use std::{
    panic::{AssertUnwindSafe, catch_unwind},
    sync::atomic::{AtomicU64, Ordering},
};

const MAX_PIXELS: u64 = 2_000_000;
static CANCEL_GENERATION: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct RenderOptions {
    pub width: u32,
    pub height: u32,
    pub center_x: f64,
    pub center_y: f64,
    pub scale: f64,
    pub max_iterations: u32,
    pub mode: String,
    pub julia_real: f64,
    pub julia_imaginary: f64,
}

#[derive(Clone, Copy)]
enum FractalMode {
    Mandelbrot,
    Julia,
}

fn unavailable(message: impl Into<String>) -> Error {
    Error::new(Status::GenericFailure, message.into())
}

fn guarded<T>(work: impl FnOnce() -> Result<T>) -> Result<T> {
    catch_unwind(AssertUnwindSafe(work)).map_err(|_| unavailable("fractal renderer panicked"))?
}

fn ensure_current(generation: u64) -> Result<()> {
    if CANCEL_GENERATION.load(Ordering::Acquire) == generation {
        Ok(())
    } else {
        Err(unavailable("fractal render was cancelled during shutdown"))
    }
}

fn validate(options: &RenderOptions) -> Result<FractalMode> {
    let pixels = u64::from(options.width) * u64::from(options.height);
    if options.width < 16
        || options.height < 16
        || options.width > 2048
        || options.height > 2048
        || pixels > MAX_PIXELS
    {
        return Err(unavailable("invalid render dimensions"));
    }
    if !options.center_x.is_finite()
        || !options.center_y.is_finite()
        || !options.scale.is_finite()
        || !(1e-14..=8.0).contains(&options.scale)
    {
        return Err(unavailable("invalid fractal viewport"));
    }
    if !(16..=2_000).contains(&options.max_iterations) {
        return Err(unavailable("invalid iteration limit"));
    }
    if !options.julia_real.is_finite()
        || !options.julia_imaginary.is_finite()
        || options.julia_real.abs() > 2.5
        || options.julia_imaginary.abs() > 2.5
    {
        return Err(unavailable("invalid Julia parameter"));
    }
    match options.mode.as_str() {
        "mandelbrot" => Ok(FractalMode::Mandelbrot),
        "julia" => Ok(FractalMode::Julia),
        _ => Err(unavailable("unsupported fractal mode")),
    }
}

fn escape_iterations(
    point_real: f64,
    point_imaginary: f64,
    constant_real: f64,
    constant_imaginary: f64,
    maximum: u32,
) -> (u32, f64) {
    let mut real = point_real;
    let mut imaginary = point_imaginary;
    for iteration in 0..maximum {
        let real_squared = real * real;
        let imaginary_squared = imaginary * imaginary;
        let magnitude_squared = real_squared + imaginary_squared;
        if magnitude_squared > 4.0 {
            return (iteration, magnitude_squared);
        }
        imaginary = 2.0 * real * imaginary + constant_imaginary;
        real = real_squared - imaginary_squared + constant_real;
    }
    (maximum, real * real + imaginary * imaginary)
}

fn color(iteration: u32, maximum: u32, magnitude_squared: f64) -> [u8; 4] {
    if iteration >= maximum {
        return [3, 5, 14, 255];
    }
    let smooth = if magnitude_squared > 1.0 {
        f64::from(iteration) + 1.0 - magnitude_squared.ln().ln() / std::f64::consts::LN_2
    } else {
        f64::from(iteration)
    };
    let t = (smooth / f64::from(maximum)).clamp(0.0, 1.0).sqrt();
    let red = 9.0 * (1.0 - t) * t * t * t;
    let green = 15.0 * (1.0 - t) * (1.0 - t) * t * t;
    let blue = 8.5 * (1.0 - t) * (1.0 - t) * (1.0 - t) * t;
    [
        (255.0 * red.clamp(0.0, 1.0)) as u8,
        (255.0 * green.clamp(0.0, 1.0)) as u8,
        (255.0 * blue.clamp(0.0, 1.0)) as u8,
        255,
    ]
}

fn render_pixels(options: &RenderOptions, generation: u64) -> Result<Vec<u8>> {
    let mode = validate(options)?;
    let byte_count = usize::try_from(u64::from(options.width) * u64::from(options.height) * 4)
        .map_err(|_| unavailable("render buffer is too large"))?;
    let mut pixels = vec![0; byte_count];
    let width = f64::from(options.width);
    let height = f64::from(options.height);

    for y in 0..options.height {
        if y % 8 == 0 {
            ensure_current(generation)?;
        }
        let point_imaginary =
            options.center_y + (f64::from(y) + 0.5 - height / 2.0) * options.scale / width;
        for x in 0..options.width {
            let point_real =
                options.center_x + (f64::from(x) + 0.5 - width / 2.0) * options.scale / width;
            let (start_real, start_imaginary, constant_real, constant_imaginary) = match mode {
                FractalMode::Mandelbrot => (0.0, 0.0, point_real, point_imaginary),
                FractalMode::Julia => (
                    point_real,
                    point_imaginary,
                    options.julia_real,
                    options.julia_imaginary,
                ),
            };
            let (iteration, magnitude_squared) = escape_iterations(
                start_real,
                start_imaginary,
                constant_real,
                constant_imaginary,
                options.max_iterations,
            );
            let offset =
                usize::try_from((u64::from(y) * u64::from(options.width) + u64::from(x)) * 4)
                    .map_err(|_| unavailable("render offset overflowed"))?;
            pixels[offset..offset + 4].copy_from_slice(&color(
                iteration,
                options.max_iterations,
                magnitude_squared,
            ));
        }
    }
    ensure_current(generation)?;
    Ok(pixels)
}

pub struct RenderTask {
    options: RenderOptions,
    generation: u64,
}

impl Task for RenderTask {
    type Output = Vec<u8>;
    type JsValue = Buffer;

    fn compute(&mut self) -> Result<Self::Output> {
        guarded(|| render_pixels(&self.options, self.generation))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output.into())
    }
}

#[napi]
pub fn render_fractal(options: RenderOptions) -> AsyncTask<RenderTask> {
    AsyncTask::new(RenderTask {
        options,
        generation: CANCEL_GENERATION.load(Ordering::Acquire),
    })
}

#[napi]
pub fn cancel_renders() {
    CANCEL_GENERATION.fetch_add(1, Ordering::AcqRel);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(mode: &str) -> RenderOptions {
        RenderOptions {
            width: 32,
            height: 24,
            center_x: -0.5,
            center_y: 0.0,
            scale: 3.5,
            max_iterations: 100,
            mode: mode.to_owned(),
            julia_real: 0.0,
            julia_imaginary: 0.0,
        }
    }

    #[test]
    fn known_mandelbrot_points_are_classified() {
        assert_eq!(escape_iterations(0.0, 0.0, 0.0, 0.0, 100).0, 100);
        assert_eq!(escape_iterations(0.0, 0.0, -1.0, 0.0, 100).0, 100);
        assert!(escape_iterations(0.0, 0.0, 1.0, 1.0, 100).0 < 100);
    }

    #[test]
    fn julia_mode_uses_the_point_as_the_initial_value() {
        assert_eq!(escape_iterations(0.0, 0.0, 0.0, 0.0, 100).0, 100);
        assert!(escape_iterations(2.0, 0.0, 0.0, 0.0, 100).0 < 100);
        assert!(
            render_pixels(&options("julia"), CANCEL_GENERATION.load(Ordering::Acquire)).is_ok()
        );
    }

    #[test]
    fn output_has_one_rgba_tuple_per_pixel() {
        let options = options("mandelbrot");
        let pixels = render_pixels(&options, CANCEL_GENERATION.load(Ordering::Acquire)).unwrap();
        assert_eq!(
            pixels.len(),
            options.width as usize * options.height as usize * 4
        );
        assert!(pixels.chunks_exact(4).all(|pixel| pixel[3] == 255));
    }

    #[test]
    fn invalid_limits_fail_without_panicking() {
        let mut invalid = options("mandelbrot");
        invalid.width = 0;
        assert!(render_pixels(&invalid, CANCEL_GENERATION.load(Ordering::Acquire)).is_err());
        invalid = options("mandelbrot");
        invalid.max_iterations = 2_001;
        assert!(render_pixels(&invalid, CANCEL_GENERATION.load(Ordering::Acquire)).is_err());
        invalid = options("unknown");
        assert!(render_pixels(&invalid, CANCEL_GENERATION.load(Ordering::Acquire)).is_err());
    }
}
