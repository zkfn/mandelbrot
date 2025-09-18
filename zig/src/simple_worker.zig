const std = @import("std");

const gpa = std.heap.wasm_allocator;

export fn alloc(len: usize) usize {
    const mem = gpa.alloc(u8, len) catch return 0;
    return @intFromPtr(mem.ptr);
}

export fn render(min_x: f64, max_x: f64, min_y: f64, max_y: f64, w: u32, h: u32, max_iter: u32, buffer_ptr: [*]u8) void {
    const size: usize = @intCast(w * h * 4);
    const buffer = buffer_ptr[0..size];

    const dx = (max_x - min_x) / @as(f64, @floatFromInt(w));
    const dy = (max_y - min_y) / @as(f64, @floatFromInt(h));

    var k: usize = 0;
    var j: u32 = 0;

    while (j < h) : (j += 1) {
        const cy = min_y + (@as(f64, @floatFromInt(j)) + 0.5) * dy;
        var i: u32 = 0;

        while (i < w) : (i += 1) {
            const cx = min_x + (@as(f64, @floatFromInt(i)) + 0.5) * dx;
            var x: f64 = 0.0;
            var y: f64 = 0.0;
            var it: u32 = 0;
            while (it < max_iter and x * x + y * y <= 4.0) : (it += 1) {
                const nx = x * x - y * y + cx;
                y = 2.0 * x * y + cy;
                x = nx;
            }
            const v: u8 = if (it >= max_iter) 0 else @intFromFloat(@floor(255.0 * @as(f64, @floatFromInt(it)) / @as(f64, @floatFromInt(max_iter))));
            buffer[k] = v;
            buffer[k + 1] = v;
            buffer[k + 2] = v;
            buffer[k + 3] = 255;
            k += 4;
        }
    }
}
