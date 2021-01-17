# Relivestyle

Relivestyle is an independent dev server for the modern web.

[![NPM version](https://img.shields.io/npm/v/relivestyle.svg)](https://www.npmjs.com/package/relivestyle)
[![Build Status](https://github.com/alexjeffburke/relivestyle/workflows/tests/badge.svg)](https://github.com/alexjeffburke/relivestyle)
[![Coverage Status](https://img.shields.io/coveralls/alexjeffburke/relivestyle/master.svg)](https://coveralls.io/r/alexjeffburke/relivestyle?branch=master)

## Introduction

Relivestyle is built to efficiently serve a static folder containing the
HTML, JavaScript and CSS files that comprise a modern web application.

The server watches the pages and related assets that make up your small
project and instantly reloads any browser that accessed them whenever
changes to the on-disk files are detected.

## Background

Modern JavaScript tooling is extremely powerful but often represents a
rather steep curve not just in terms of learning but also implementation.

Meanwhile, the capabilities made available within modern broswsers make
it possible to build modular applications without requiring on such tools.
Relivestyle is a dev server with minimal dependencies and no configuration
which enables reload-on-change style development for such applications.

This project aims to support this use-case.

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

We believe that mandating the use of particular tools in order to assemble
a fully functional application is unecessary with the advent of ES Modules.

The project provides the ability to quickly iterate on browser first software.
Tools such as bundlers, transpilers etc are often necessary for fully formed
porjects - particularly for optimised bundles - but present a barrier when
wishing to experiment within the browser and have a tendency of becoming
mandatory should the software work at all.

We believe that the use of any particular tools should be a progressive addition
and that modern web projects can be fully fucntional and capable without them.

All this leads to some rather different choices and trade-offs being made:

### Server-side asset tracking

In order support its use without modifying projects, the server records information
about the static assets dynamically and uses this to

The server leverages the excellent [AssetGraph](https://github.com/assetgraph/assetgraph)
project to track assets they are made use of. As clients loads pages we
build out the graph-based representation of the what is being loaded and
inform clients that they must reload when there was a relevant change.

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

## Credits

Relivestyle watches the pages and related assets that make up your small
project and instantly reloads any browser that loaded them whenever any
changes are detected. This is not a totally new idea, and if it sounds
familiar then please let us make a huge nod to
[livestyle](https://github.com/One-com/livestyle))
that inspired this effort.

## License

MIT © Alex J Burke
