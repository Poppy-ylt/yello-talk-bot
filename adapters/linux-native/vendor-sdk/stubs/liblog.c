/**
 * Stub liblog.so for running Android .so files on Linux.
 * The Android GME SDK links against liblog.so for __android_log_* functions.
 * This stub redirects those calls to stderr.
 */
#include <stdio.h>
#include <stdarg.h>

__attribute__((visibility("default")))
int __android_log_write(int prio, const char* tag, const char* text) {
    return fprintf(stderr, "[%d/%s] %s\n", prio, tag ? tag : "GME", text ? text : "");
}

__attribute__((visibility("default")))
int __android_log_print(int prio, const char* tag, const char* fmt, ...) {
    va_list ap;
    fprintf(stderr, "[%d/%s] ", prio, tag ? tag : "GME");
    va_start(ap, fmt);
    int ret = vfprintf(stderr, fmt, ap);
    va_end(ap);
    fprintf(stderr, "\n");
    return ret;
}

__attribute__((visibility("default")))
int __android_log_vprint(int prio, const char* tag, const char* fmt, va_list ap) {
    fprintf(stderr, "[%d/%s] ", prio, tag ? tag : "GME");
    int ret = vfprintf(stderr, fmt, ap);
    fprintf(stderr, "\n");
    return ret;
}
