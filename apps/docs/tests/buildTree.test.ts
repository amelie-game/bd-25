import { describe, it, expect } from "vitest";
import { buildTree, ROOT_NAME } from "../src/utils/buildTree";
import type { Doc } from "../src/types/Doc";

describe("buildTree", () => {
  it("creates a single node for a single doc at root", () => {
    const docs = [
      {
        id: "readme",
        filePath: "README.md",
        data: { title: "Read Me" },
      }, // minimal mock
    ] satisfies Doc[];

    const tree = buildTree(docs);

    expect(tree).toStrictEqual({
      name: ROOT_NAME,
      children: [
        {
          name: "README.md",
          slug: "readme",
          title: "README.md",
          children: [],
        },
      ],
    });
  });

  it("replaces the root node if it only has one folder as a child", () => {
    const docs = [
      {
        id: "foo/readme",
        filePath: "foo/README.md",
        data: { title: "Read Me" },
      }, // minimal mock
    ] satisfies Doc[];

    const tree = buildTree(docs);

    expect(tree).toStrictEqual({
      name: "foo",
      title: "foo",
      slug: undefined,
      children: [
        {
          name: "README.md",
          slug: "foo/readme",
          title: "README.md",
          children: [],
        },
      ],
    });
  });

  it("creates nested nodes for nested docs", () => {
    const docs = [
      {
        id: "foo/bar",
        filePath: "foo/bar.md",
        data: { title: "Bar" },
      },
      {
        id: "foo/baz",
        filePath: "foo/baz.md",
        data: { title: "Baz" },
      },
    ] satisfies Doc[];

    const tree = buildTree(docs);

    expect(tree).toStrictEqual({
      name: "foo",
      slug: undefined,
      title: "foo",
      children: [
        {
          name: "bar.md",
          slug: "foo/bar",
          title: "bar.md",
          children: [],
        },
        {
          name: "baz.md",
          slug: "foo/baz",
          title: "baz.md",
          children: [],
        },
      ],
    });
  });

  it("sorts directories before files and alphabetically", () => {
    const docs = [
      {
        id: "b",
        filePath: "b.md",
        data: {},
      },
      {
        id: "a/x",
        filePath: "a/x.md",
        data: {},
      },
      {
        id: "a/y",
        filePath: "a/y.md",
        data: {},
      },
    ] satisfies Doc[];

    const tree = buildTree(docs);

    expect(tree).toStrictEqual({
      name: ROOT_NAME,
      children: [
        {
          name: "a",
          slug: undefined,
          title: "a",
          children: [
            {
              name: "x.md",
              slug: "a/x",
              title: "x.md",
              children: [],
            },
            {
              name: "y.md",
              slug: "a/y",
              title: "y.md",
              children: [],
            },
          ],
        },
        {
          name: "b.md",
          slug: "b",
          title: "b.md",
          children: [],
        },
      ],
    });
  });

  it("joins path parts together when they only contain 1 child", () => {
    const docs = [
      {
        id: "foo/bar",
        filePath: "foo/bar.md",
        data: { title: "Bar" },
      },
      {
        id: "foo/fizz/buzz/baz",
        filePath: "foo/fizz/buzz/baz.md",
        data: { title: "Baz" },
      },
    ] satisfies Doc[];

    const tree = buildTree(docs);

    expect(tree).toStrictEqual({
      name: "foo",
      slug: undefined,
      title: "foo",
      children: [
        {
          name: "fizz/buzz",
          slug: undefined,
          title: "fizz/buzz",
          children: [
            {
              name: "baz.md",
              slug: "foo/fizz/buzz/baz",
              title: "baz.md",
              children: [],
            },
          ],
        },
        {
          name: "bar.md",
          slug: "foo/bar",
          title: "bar.md",
          children: [],
        },
      ],
    });
  });
});
