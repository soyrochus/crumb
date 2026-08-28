import { describe, expect, test } from "bun:test";
import { InvalidOutputNameError, MissingApplicationNameError, outputPath, resolveApplication, selectedApplicationName, selectedOutputName, UnknownApplicationError, type ApplicationRegistry } from "../../src/kit/shared/config";
import { registry } from "../../app.config";

const fixture: ApplicationRegistry = {
  default: "alpha",
  applications: {
    alpha: { ...registry.applications.starter!, name: "Alpha" },
    beta: { ...registry.applications.starter!, name: "Beta" },
  },
};

describe("application selection", () => {
  test("resolves the default when unnamed", () => {
    expect(resolveApplication(fixture).name).toBe("Alpha");
  });

  test("resolves a named application", () => {
    expect(resolveApplication(fixture, "beta").name).toBe("Beta");
  });

  test("rejects an unknown name and lists what is available", () => {
    expect(() => resolveApplication(fixture, "gamma")).toThrow(UnknownApplicationError);
    expect(() => resolveApplication(fixture, "gamma")).toThrow("alpha, beta");
  });

  test("does not resolve inherited object properties as applications", () => {
    for (const name of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(() => resolveApplication(fixture, name)).toThrow(UnknownApplicationError);
    }
  });

  test("derives the output path from the selected name and target", () => {
    expect(outputPath("alpha", "macos-arm64")).toBe("dist/alpha-macos-arm64");
    expect(outputPath("beta", "linux-x64")).toBe("dist/beta-linux-x64");
  });
});

describe("this repository's registry", () => {
  test("defaults to the minimal starter, with the explorer available by name", () => {
    expect(registry.default).toBe("starter");
    expect(Object.keys(registry.applications).sort()).toEqual(["file-explorer", "starter"]);
  });

  test("each application builds to its own filename", () => {
    const names = Object.keys(registry.applications).map((name) => outputPath(name, "macos-arm64"));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("dist/file-explorer-macos-arm64");
  });
});

describe("--example parsing", () => {
  test("reads the equals form", () => {
    expect(selectedApplicationName(["bun", "dev", "--example=file-explorer"])).toBe("file-explorer");
  });

  test("reads the space form", () => {
    expect(selectedApplicationName(["bun", "dev", "--example", "file-explorer"])).toBe("file-explorer");
  });

  test("returns undefined when the flag is absent, so the default applies", () => {
    expect(selectedApplicationName(["bun", "dev", "--no-watch"])).toBeUndefined();
  });

  test("rejects a bare --example rather than silently using the default", () => {
    expect(() => selectedApplicationName(["bun", "dev", "--example"])).toThrow(MissingApplicationNameError);
    expect(() => selectedApplicationName(["bun", "dev", "--example", "--no-watch"])).toThrow(MissingApplicationNameError);
  });
});

describe("--output parsing and safety", () => {
  test("reads both flag forms", () => {
    expect(selectedOutputName(["bun", "build", "--output=my-app"])).toBe("my-app");
    expect(selectedOutputName(["bun", "build", "--output", "my-app"])).toBe("my-app");
  });

  test("returns undefined when absent, so the application name is used", () => {
    expect(selectedOutputName(["bun", "build", "--target=macos-arm64"])).toBeUndefined();
  });

  test("rejects a bare --output", () => {
    expect(() => selectedOutputName(["bun", "build", "--output"])).toThrow(InvalidOutputNameError);
    expect(() => selectedOutputName(["bun", "build", "--output", "--target=x"])).toThrow(InvalidOutputNameError);
  });

  test("refuses a name that would escape dist/", () => {
    for (const unsafe of ["../evil", "a/b", "/abs", "", ".hidden", "-dash"]) {
      expect(() => outputPath(unsafe, "macos-arm64"), unsafe).toThrow(InvalidOutputNameError);
    }
  });

  test("accepts ordinary names", () => {
    expect(outputPath("my-app_2.1", "linux-x64")).toBe("dist/my-app_2.1-linux-x64");
  });
});
