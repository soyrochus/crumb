use napi::{Env, Error, Result, Status, Task, bindgen_prelude::AsyncTask};
use napi_derive::napi;
use std::{
    panic::{AssertUnwindSafe, catch_unwind},
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use sysinfo::{MINIMUM_CPU_UPDATE_INTERVAL, Pid, ProcessesToUpdate, System};

static CANCEL_GENERATION: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct SystemSnapshotValue {
    pub cpu_percent: Option<f64>,
    pub total_memory_bytes: Option<f64>,
    pub used_memory_bytes: Option<f64>,
    pub process_count: u32,
    pub load_one: Option<f64>,
    pub load_five: Option<f64>,
    pub load_fifteen: Option<f64>,
    pub sampled_at_ms: f64,
}

#[napi(object)]
pub struct ProcessSummaryValue {
    pub identifier: u32,
    pub name: String,
    pub cpu_percent: Option<f64>,
    pub memory_bytes: Option<f64>,
    pub state: Option<String>,
}

#[napi(object)]
pub struct ProcessDetailsValue {
    pub identifier: u32,
    pub name: String,
    pub cpu_percent: Option<f64>,
    pub memory_bytes: Option<f64>,
    pub state: Option<String>,
    pub parent_identifier: Option<u32>,
    pub executable: Option<String>,
    pub started_at_seconds: Option<f64>,
    pub run_time_seconds: Option<f64>,
}

fn unavailable(message: impl Into<String>) -> Error {
    Error::new(Status::GenericFailure, message.into())
}

fn guarded<T>(work: impl FnOnce() -> Result<T>) -> Result<T> {
    catch_unwind(AssertUnwindSafe(work)).map_err(|_| unavailable("system collection panicked"))?
}

fn ensure_current(generation: u64) -> Result<()> {
    if CANCEL_GENERATION.load(Ordering::Acquire) == generation {
        Ok(())
    } else {
        Err(unavailable(
            "system collection was cancelled during shutdown",
        ))
    }
}

fn collect(generation: u64) -> Result<System> {
    ensure_current(generation)?;
    let mut system = System::new_all();
    thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
    ensure_current(generation)?;
    system.refresh_cpu_usage();
    system.refresh_processes(ProcessesToUpdate::All, true);
    ensure_current(generation)?;
    Ok(system)
}

fn process_summary(pid: Pid, process: &sysinfo::Process) -> ProcessSummaryValue {
    ProcessSummaryValue {
        identifier: pid.as_u32(),
        name: process.name().to_string_lossy().into_owned(),
        cpu_percent: Some(f64::from(process.cpu_usage())),
        memory_bytes: Some(process.memory() as f64),
        state: Some(process.status().to_string()),
    }
}

fn process_details_value(system: &System, pid: Pid) -> Option<ProcessDetailsValue> {
    system.process(pid).map(|process| ProcessDetailsValue {
        identifier: pid.as_u32(),
        name: process.name().to_string_lossy().into_owned(),
        cpu_percent: Some(f64::from(process.cpu_usage())),
        memory_bytes: Some(process.memory() as f64),
        state: Some(process.status().to_string()),
        parent_identifier: process.parent().map(Pid::as_u32),
        executable: process
            .exe()
            .map(|path| path.to_string_lossy().into_owned()),
        started_at_seconds: Some(process.start_time() as f64),
        run_time_seconds: Some(process.run_time() as f64),
    })
}

pub struct SystemSnapshotTask {
    generation: u64,
}

impl Task for SystemSnapshotTask {
    type Output = SystemSnapshotValue;
    type JsValue = SystemSnapshotValue;

    fn compute(&mut self) -> Result<Self::Output> {
        guarded(|| {
            let system = collect(self.generation)?;
            let load = System::load_average();
            let sampled_at_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| unavailable("system clock is before the Unix epoch"))?
                .as_millis() as f64;
            Ok(SystemSnapshotValue {
                cpu_percent: Some(f64::from(system.global_cpu_usage())),
                total_memory_bytes: Some(system.total_memory() as f64),
                used_memory_bytes: Some(system.used_memory() as f64),
                process_count: u32::try_from(system.processes().len()).unwrap_or(u32::MAX),
                load_one: Some(load.one),
                load_five: Some(load.five),
                load_fifteen: Some(load.fifteen),
                sampled_at_ms,
            })
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

pub struct ProcessListTask {
    generation: u64,
}

impl Task for ProcessListTask {
    type Output = Vec<ProcessSummaryValue>;
    type JsValue = Vec<ProcessSummaryValue>;

    fn compute(&mut self) -> Result<Self::Output> {
        guarded(|| {
            let system = collect(self.generation)?;
            Ok(system
                .processes()
                .iter()
                .map(|(&pid, process)| process_summary(pid, process))
                .collect())
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

pub struct ProcessDetailsTask {
    generation: u64,
    identifier: u32,
}

impl Task for ProcessDetailsTask {
    type Output = Option<ProcessDetailsValue>;
    type JsValue = Option<ProcessDetailsValue>;

    fn compute(&mut self) -> Result<Self::Output> {
        guarded(|| {
            let system = collect(self.generation)?;
            Ok(process_details_value(
                &system,
                Pid::from_u32(self.identifier),
            ))
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi]
pub fn system_snapshot() -> AsyncTask<SystemSnapshotTask> {
    AsyncTask::new(SystemSnapshotTask {
        generation: CANCEL_GENERATION.load(Ordering::Acquire),
    })
}

#[napi]
pub fn process_list() -> AsyncTask<ProcessListTask> {
    AsyncTask::new(ProcessListTask {
        generation: CANCEL_GENERATION.load(Ordering::Acquire),
    })
}

#[napi]
pub fn process_details(identifier: u32) -> AsyncTask<ProcessDetailsTask> {
    AsyncTask::new(ProcessDetailsTask {
        generation: CANCEL_GENERATION.load(Ordering::Acquire),
        identifier,
    })
}

#[napi]
pub fn cancel_sampling() {
    CANCEL_GENERATION.fetch_add(1, Ordering::AcqRel);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_and_process_shapes_are_populated() {
        let system = collect(CANCEL_GENERATION.load(Ordering::Acquire)).unwrap();
        assert!(system.total_memory() > 0);
        assert!(!system.processes().is_empty());
        let (&pid, process) = system.processes().iter().next().unwrap();
        let item = process_summary(pid, process);
        assert_eq!(item.identifier, pid.as_u32());
        assert!(!item.name.contains('\0'));
    }

    #[test]
    fn absent_process_is_not_an_error() {
        let system = System::new_all();
        assert!(process_details_value(&system, Pid::from_u32(u32::MAX)).is_none());
    }

    #[cfg(unix)]
    #[test]
    fn process_that_exits_before_inspection_is_absent() {
        let mut child = std::process::Command::new("true").spawn().unwrap();
        let pid = Pid::from_u32(child.id());
        child.wait().unwrap();
        let mut system = System::new_all();
        system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
        assert!(process_details_value(&system, pid).is_none());
    }
}
