const math = @import("std").math;
const mem = @import("std").mem;
const gpa = @import("std").heap.wasm_allocator;

/// WASM-side memory allocation. Returns address of the allocated region. In
/// case of an exception, the return value will be 0.
export fn alloc(len: usize) usize {
    const mm = gpa.alloc(u8, len) catch return 0;
    return @intFromPtr(mm.ptr);
}

const Point = struct { x: f64, y: f64 };

fn lerp8(a: u8, b: u8, t: f64) u8 {
    const af = @as(f64, @floatFromInt(a));
    const bf = @as(f64, @floatFromInt(b));
    const v = math.clamp(af + (bf - af) * t, 0.0, 255.0);
    return @intFromFloat(v);
}

fn lerpColorRGBA(c0: u32, c1: u32, t: f64) u32 {
    const r0: u8 = @intCast((c0 >> 24) & 0xff);
    const g0: u8 = @intCast((c0 >> 16) & 0xff);
    const b0: u8 = @intCast((c0 >> 8) & 0xff);
    const a0: u8 = @intCast(c0 & 0xff);

    const r1: u8 = @intCast((c1 >> 24) & 0xff);
    const g1: u8 = @intCast((c1 >> 16) & 0xff);
    const b1: u8 = @intCast((c1 >> 8) & 0xff);
    const a1: u8 = @intCast(c1 & 0xff);

    const r = lerp8(r0, r1, t);
    const g = lerp8(g0, g1, t);
    const b = lerp8(b0, b1, t);
    const a = lerp8(a0, a1, t);
    return (@as(u32, r) << 24) | (@as(u32, g) << 16) | (@as(u32, b) << 8) | a;
}

fn paletteLookupCyclic(pal: []const u32, mu: f64, scale: f64) u32 {
    if (pal.len == 0) return 0xff000000;
    const x = @max(0.0, mu) * scale;
    const i_0: usize = @intFromFloat(@floor(x));
    const t = x - @floor(x);
    const a = pal[i_0 % pal.len];
    const b = pal[(i_0 + 1) % pal.len];
    return lerpColorRGBA(a, b, t);
}

fn paletteLookupClamped(pal: []const u32, mu: f64, max_iter: u32) u32 {
    if (pal.len == 0) return 0xff000000;
    const t = math.clamp(mu / @as(f64, @floatFromInt(max_iter)), 0.0, 1.0);
    const x = t * @as(f64, @floatFromInt(pal.len - 1));
    const i_0: usize = @intFromFloat(@floor(x));
    const i_1 = @min(i_0 + 1, pal.len - 1);
    const frac = x - @floor(x);
    return lerpColorRGBA(pal[i_0], pal[i_1], frac);
}

pub fn shade(mu: f64, palette: []const u32) u32 {
    return paletteLookupCyclic(palette, mu, 0.12);
}

const RGBABuffer = struct {
    as_slice: []u8,
    position: usize,

    const Self = @This();
    const MaxAlpha = 255;

    pub fn init(buf_ptr: [*]u8, pixels: u32) Self {
        return Self{
            .as_slice = buf_ptr[0..(pixels * 4)],
            .position = 0,
        };
    }

    pub fn insertAndAdvance(self: *Self, value: anytype) void {
        switch (@typeInfo(@TypeOf(value)).int.bits) {
            8 => {
                self.as_slice[self.position] = value;
                self.as_slice[self.position + 1] = value;
                self.as_slice[self.position + 2] = value;
                self.as_slice[self.position + 3] = MaxAlpha;
            },
            32 => {
                // const as_u32 = mem.bytesAsSlice(u32, self.as_slice[self.position..]);
                // as_u32[0] = value;

                self.as_slice[self.position + 0] = @intCast((value >> 24) & 0xff); // R
                self.as_slice[self.position + 1] = @intCast((value >> 16) & 0xff); // G
                self.as_slice[self.position + 2] = @intCast((value >> 8) & 0xff); // B
                self.as_slice[self.position + 3] = @intCast(value & 0xff); // A
            },
            else => @compileError("Unsuported type"),
        }

        self.position += 4;
    }
};

const PointIterator = struct {
    dx: f64,
    dy: f64,

    x0: f64,
    width_px: u32,
    height_px: u32,

    x: f64,
    y: f64,

    px_x: u32 = 0,
    px_y: u32 = 0,

    const Self = @This();

    pub fn init(
        min_x: f64,
        max_x: f64,
        min_y: f64,
        max_y: f64,
        width_px: u32,
        height_px: u32,
    ) Self {
        const dx = (max_x - min_x) / @as(f64, @floatFromInt(width_px));
        const dy = (max_y - min_y) / @as(f64, @floatFromInt(height_px));
        const x0 = min_x + 0.5 * dx;
        const y0 = min_y + 0.5 * dy;

        return .{
            .dx = dx,
            .dy = dy,
            .x = x0,
            .y = y0,
            .x0 = x0,
            .width_px = width_px,
            .height_px = height_px,
        };
    }

    pub fn next(self: *Self) ?Point {
        if (!self.isDone()) {
            defer self.advance();
            return .{ .x = self.x, .y = self.y };
        } else {
            return null;
        }
    }

    fn advance(self: *Self) void {
        self.px_x += 1;
        self.x += self.dx;

        if (self.px_x >= self.width_px) {
            self.px_x = 0;
            self.x = self.x0;

            self.px_y += 1;
            self.y += self.dy;
        }
    }

    fn isDone(self: *Self) bool {
        return self.px_y >= self.height_px;
    }
};

const MandelbrotIterator = struct {
    iters: u32 = 0,
    x: f64 = 0.0,
    y: f64 = 0.0,
    x2: f64 = 0.0,
    y2: f64 = 0.0,
    point: Point,

    const Self = @This();

    pub fn init(point: Point) Self {
        return .{ .point = point };
    }

    pub fn runUntilEscapesOrMaxIsReached(self: *Self, max_iter: u32) void {
        while (self.iters < max_iter and self.absSquared() < 40.0) {
            self.advance();
        }
    }

    pub fn absSquared(self: *Self) f64 {
        return self.x2 + self.y2;
    }

    pub fn advance(self: *Self) void {
        self.y = (self.x + self.x) * self.y + self.point.y;
        self.x = self.x2 - self.y2 + self.point.x;
        self.x2 = self.x * self.x;
        self.y2 = self.y * self.y;
        self.iters += 1;
    }
};

export fn render(
    min_x: f64,
    max_x: f64,
    min_y: f64,
    max_y: f64,
    width_px: u32,
    height_px: u32,
    max_iter: u32,
    buffer_ptr: [*]u8,
) void {
    var buffer = RGBABuffer.init(buffer_ptr, width_px * height_px);
    var point_iter = PointIterator.init(min_x, max_x, min_y, max_y, width_px, height_px);

    // const palette: []const u32 = &.{
    //     0x421E0FFF, // brown
    //     0x19071AFF, // dark purple
    //     0x09012FFF, // indigo
    //     0x040449FF, // blue-black
    //     0x000764FF, // deep blue
    //     0x0C2C8AFF, // blue
    //     0x1852B1FF, // blue-cyan
    //     0x397DD1FF, // cyan
    //     0x86B5E5FF, // light cyan
    //     0xD3ECF8FF, // very light
    //     0xF1E9BF7F, // pastel yellow
    //     0xF8C95DFF, // yellow-orange
    //     0xFFAA00FF, // orange
    //     0xCC8000FF, // brown-orange
    //     0x995700FF, // dark orange
    //     0x000000FF, // black
    // };

    // const palette: []const u32 = &.{
    //     0x000000FF, // black
    //     0x995700FF, // dark orange
    //     0xCC8000FF, // brown-orange
    //     0xFFAA00FF, // orange
    //     0xF8C95DFF, // yellow-orange
    //     0xF1E9BF7F, // pastel yellow
    //     0xD3ECF8FF, // very light
    //     0x86B5E5FF, // light cyan
    //     0x397DD1FF, // cyan
    //     0x1852B1FF, // blue-cyan
    //     0x0C2C8AFF, // blue
    //     0x000764FF, // deep blue
    //     0x040449FF, // blue-black
    //     0x09012FFF, // indigo
    //     0x19071AFF, // dark purple
    //     0x421E0FFF, // brown
    // };

    // const palette: []const u32 = &.{
    //     0x000000FF, // black
    //     0x555555FF, // dark gray
    //     0xAAAAAAFF, // light gray
    //     0xFFFFFFFF, // white
    // };

    const palette: []const u32 = &.{
        0x000000FF, // black
        0x660000FF, // dark red
        0xFF0000FF, // red
        0xFFAA00FF, // orange
        0xFFFF00FF, // yellow
        0xFFFFFFFF, // white
    };

    while (point_iter.next()) |point| {
        var mandelbrotIterator = MandelbrotIterator.init(point);
        mandelbrotIterator.runUntilEscapesOrMaxIsReached(max_iter);

        // Do two extra iterations for better smoothing
        mandelbrotIterator.advance();
        mandelbrotIterator.advance();

        const modulus = @sqrt(mandelbrotIterator.absSquared());
        const mu: f64 = @as(f64, @floatFromInt(mandelbrotIterator.iters)) - @log2(@log2(modulus));

        const value = shade(mu, palette);
        buffer.insertAndAdvance(value);
    }
}

// Dummy usage of the exported methods, since -O3 removes them as unused.
comptime {
    _ = &render;
    _ = &alloc;
}
