const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(std.Target.Query.parse(.{ .arch_os_abi = "wasm32-freestanding" }) catch @panic("Could not resolve querry"));

    const wasm_simple = b.addExecutable(.{
        .name = "simple_worker",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/simple_worker.zig"),
            .target = target,
            .optimize = .ReleaseFast,
        }),
    });

    wasm_simple.entry = .disabled;
    wasm_simple.rdynamic = true;

    b.installArtifact(wasm_simple);
}
