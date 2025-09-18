const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(std.Target.Query.parse(.{ .arch_os_abi = "wasm32-wasi" }) catch @panic("Could not resolve querry"));
    const optimize = b.standardOptimizeOption(.{});

    const wasm_simple = b.addExecutable(.{
        .name = "simple_worker",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/simple_worker.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    wasm_simple.entry = .disabled;
    b.installArtifact(wasm_simple);
}
