#!/bin/bash
# Build compatibility stubs for running Android GME SDK on glibc Linux.
#
# This script:
#   1. Builds liblog.so (Android logging stub)
#   2. Builds bionic_compat.so (bionic-specific symbol stubs)
#   3. Builds libOpenSLES.so (OpenSL ES audio stub)
#   4. Patches Android .so files to remove bionic version requirements
#   5. Creates system library symlinks (libc.so -> libc.so.6, etc.)
#
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$SCRIPT_DIR/../lib"

echo "=== Building Android compatibility layer ==="

# Step 1: Build liblog.so (Android __android_log_* stubs)
echo "[1/5] Building liblog.so..."
gcc -shared -fPIC -o "$LIB_DIR/liblog.so" "$SCRIPT_DIR/liblog.c"
echo "  Built: $LIB_DIR/liblog.so"

# Step 2: Build bionic_compat.so (bionic-specific symbols)
echo "[2/5] Building bionic_compat.so..."
gcc -shared -fPIC -o "$LIB_DIR/libbionic_compat.so" "$SCRIPT_DIR/bionic_compat.c" -lpthread
echo "  Built: $LIB_DIR/libbionic_compat.so"

# Step 3: Build libOpenSLES.so (OpenSL ES audio stub)
echo "[3/5] Building libOpenSLES.so..."
gcc -shared -fPIC -o "$LIB_DIR/libOpenSLES.so" "$SCRIPT_DIR/opensl_stub.c"
echo "  Built: $LIB_DIR/libOpenSLES.so"

# Step 4: Patch Android .so files to remove LIBC version requirements
echo "[4/5] Patching Android .so files (removing bionic symbol versions)..."
PATCH_DONE_MARKER="$LIB_DIR/.patched"
if [ -f "$PATCH_DONE_MARKER" ]; then
    echo "  Already patched (remove $PATCH_DONE_MARKER to re-patch)"
else
    python3 "$SCRIPT_DIR/patch_elf_versions.py" \
        "$LIB_DIR/libgmesdk.so" \
        "$LIB_DIR/libgmefdkaac.so" \
        "$LIB_DIR/libgmelamemp3.so" \
        "$LIB_DIR/libgmeogg.so" \
        "$LIB_DIR/libgmefaad2.so" \
        "$LIB_DIR/libgmesoundtouch.so"
    touch "$PATCH_DONE_MARKER"
fi

# Step 4: Create symlinks for DT_NEEDED resolution
# Android .so files link against libc.so (not libc.so.6), etc.
echo "[5/5] Creating system library symlinks..."

# Find the system lib directory
if [ -d "/lib/x86_64-linux-gnu" ]; then
    SYSLIB="/lib/x86_64-linux-gnu"
elif [ -d "/usr/lib/x86_64-linux-gnu" ]; then
    SYSLIB="/usr/lib/x86_64-linux-gnu"
elif [ -d "/lib64" ]; then
    SYSLIB="/lib64"
else
    SYSLIB="/usr/lib"
fi

create_symlink() {
    local name="$1"
    local target="$2"
    if [ ! -e "$LIB_DIR/$name" ] || [ -L "$LIB_DIR/$name" ]; then
        if [ -f "$target" ]; then
            ln -sf "$target" "$LIB_DIR/$name"
            echo "  $name -> $target"
        else
            echo "  WARNING: $target not found, skipping $name"
        fi
    else
        echo "  $name already exists (not a symlink), skipping"
    fi
}

# libc.so -> system libc.so.6
for f in "$SYSLIB/libc.so.6" "$SYSLIB/libc-*.so"; do
    if [ -f "$f" ]; then
        create_symlink "libc.so" "$f"
        break
    fi
done

# libm.so -> system libm.so.6
for f in "$SYSLIB/libm.so.6" "$SYSLIB/libm-*.so"; do
    if [ -f "$f" ]; then
        create_symlink "libm.so" "$f"
        break
    fi
done

# libdl.so -> system libdl.so.2
for f in "$SYSLIB/libdl.so.2" "$SYSLIB/libdl-*.so"; do
    if [ -f "$f" ]; then
        create_symlink "libdl.so" "$f"
        break
    fi
done

# libz.so -> system libz.so
for f in "$SYSLIB/libz.so" "$SYSLIB/libz.so.1"; do
    if [ -f "$f" ]; then
        create_symlink "libz.so" "$f"
        break
    fi
done

echo ""
echo "=== Done! Library directory contents: ==="
ls -la "$LIB_DIR/"
