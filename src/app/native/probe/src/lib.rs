#![allow(non_camel_case_types)]

use std::ffi::{c_char, c_void};

type napi_env = *mut c_void;
type napi_value = *mut c_void;
type napi_callback_info = *mut c_void;
type napi_status = i32;
type napi_callback = Option<unsafe extern "C" fn(napi_env, napi_callback_info) -> napi_value>;

unsafe extern "C" {
    fn napi_create_int32(env: napi_env, value: i32, result: *mut napi_value) -> napi_status;
    fn napi_create_function(
        env: napi_env,
        utf8name: *const c_char,
        length: usize,
        callback: napi_callback,
        data: *mut c_void,
        result: *mut napi_value,
    ) -> napi_status;
    fn napi_set_named_property(
        env: napi_env,
        object: napi_value,
        utf8name: *const c_char,
        value: napi_value,
    ) -> napi_status;
}

unsafe extern "C" fn answer(env: napi_env, _info: napi_callback_info) -> napi_value {
    let mut result = std::ptr::null_mut();
    unsafe { napi_create_int32(env, 42, &mut result) };
    result
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_register_module_v1(env: napi_env, exports: napi_value) -> napi_value {
    let name = c"answer";
    let mut function = std::ptr::null_mut();
    unsafe {
        napi_create_function(
            env,
            name.as_ptr(),
            name.to_bytes().len(),
            Some(answer),
            std::ptr::null_mut(),
            &mut function,
        );
        napi_set_named_property(env, exports, name.as_ptr(), function);
    }
    exports
}
