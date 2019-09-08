# Relivestyle

Relivestyle is a small web server that refreshes pages served
by it when they, or any assets they link to, change on disk.

## Introduction

Modern JavaScript tooling is extremely powerful but often represents a
rather steep curve not just in terms of learning but also implementation.

These tools and the setup work they require are often necessary for fully
formed projects - but present a barrier when wishing to experiment within
the browser. This project aims to support this use-case.

Relivestyle watches the pages and related assets that make up your small
project and instantly reloads any browser that loaded them whenever any
changes are detected. This is not a totally new idea, and if it sounds
familiar then please let us make a huge nod to
[livestyle](https://github.com/One.com/livestyle))
that heavily inspired this effort.

## Use

The following is all you need to bring up the server on a directory:

```
npx relivestyle /path/to/static/folder
```

From that point the contents of the folder are served by the server
and will be reflected in browsers that load the pages.

If you wish to start the server on a fixed port for the purposes of a
development setup, you can specify a `--port` argument:

```
npx relivestyle --port 5000 /path/to/static/folder
```

> this can be useful if stopping the server as the client
> in the browser will attempt to automatically reconnect

## Philosophy

As mentioned this project is heavily inspired by Livestyle but there are
a number of radical differences that coalesce in a completely new codebase:

### Server-side asset tracking

The server leverages the excellent [AssetGraph](https://github.com/assetgraph/assetgraph)
project to track clients and the assets they use. As the client loads pages we
build out the graph-based representation of the what is being loaded and use it
to inform a client that it must reload when there was a relevant change.

### Strictly avoid asset generation

The project seeks to solve a very narrow problem and thus we avoid any
integration with build tools. Believing that tools should be orthoganal,
we make no assumptions about the assets we serve and make sure that we
enable you to easily evole your use of tools are your project grows.

This means by default we make it very easy to write modern web pages and
applications using newer web standards like ES Modules with import/export
syntax. If you later decide that you require transpilation for syntax that
is not yet standardised or for use in older browsers, you can simply have
the output written into the directory served out be Relivestyle and your
workflow does not need to change. If the files change, we simply reload.

## License

MIT © Alex J Burke
