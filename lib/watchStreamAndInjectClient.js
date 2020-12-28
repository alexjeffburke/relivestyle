/* eslint-disable no-var */
/*
Copyright (c) 2011, Peter Müller and Andreas Lind Petersen
Copyright (c) 2019, Alex J Burke

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in
    the documentation and/or other materials provided with the
    distribution.
  * Neither the name of the author nor the names of contributors may
    be used to endorse or promote products derived from this
    software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

module.exports = function watchStreamAndInjectClient(inStream, outStream) {
    var injected = false;
    var state = 0;

    function injectScriptAtIndex(chunk, i) {
        if (i > 0) {
            outStream.write(chunk.slice(0, i));
        }
        outStream.write(
            '<script src="/__livestyle/sockette.js"></script>' +
                '<script src="/__livestyle/client.js"></script>'
        );
        if (chunk.length > i) {
            outStream.write(chunk.slice(i));
        }
        injected = true;
    }

    inStream
        .on("end", function() {
            if (!injected) {
                injectScriptAtIndex(Buffer.from([]), 0);
            }
            outStream.end();
        })
        .on("data", function(chunk, encoding) {
            if (injected) {
                outStream.write(chunk, encoding);
            } else {
                for (var i = 0; i < chunk.length; i += 1) {
                    var ch;
                    if (Buffer.isBuffer(chunk)) {
                        ch = String.fromCharCode(chunk[i]);
                    } else {
                        // string
                        ch = chunk[i];
                    }
                    switch (state) {
                        case 0:
                            if (ch === "<") {
                                state = 1;
                            }
                            break;
                        case 1: // <
                            if (ch === "/") {
                                state = 2;
                            } else if (ch === "s" || ch === "S") {
                                state = 10;
                            } else {
                                state = 0;
                            }
                            break;
                        case 2: // </
                            if (ch === "h" || ch === "H") {
                                state = 3;
                            } else {
                                state = 0;
                            }
                            break;
                        case 3: // </h
                            if (ch === "e" || ch === "E") {
                                state = 4;
                            } else if (ch === "t" || ch === "T") {
                                state = 7;
                            } else {
                                state = 0;
                            }
                            break;
                        case 4: // </he
                            if (ch === "a" || ch === "A") {
                                state = 5;
                            } else {
                                state = 0;
                            }
                            break;
                        case 5: // </hea
                            if (ch === "d" || ch === "D") {
                                state = 6;
                            } else {
                                state = 0;
                            }
                            break;
                        case 6: // </head
                            if (ch === ">" || ch === " ") {
                                injectScriptAtIndex(
                                    chunk,
                                    i + 1 - "</head>".length
                                );
                                return;
                            } else {
                                state = 0;
                            }
                            break;
                        case 7: // </ht
                            if (ch === "m" || ch === "M") {
                                state = 8;
                            } else {
                                state = 0;
                            }
                            break;
                        case 8: // </htm
                            if (ch === "l" || ch === "L") {
                                state = 9;
                            } else {
                                state = 0;
                            }
                            break;
                        case 9: // </html
                            if (ch === ">" || ch === " ") {
                                injectScriptAtIndex(
                                    chunk,
                                    i + 1 - "</html>".length
                                );
                                return;
                            } else {
                                state = 0;
                            }
                            break;
                        case 10: // <s
                            if (ch === "c" || ch === "C") {
                                state = 11;
                            } else {
                                state = 0;
                            }
                            break;
                        case 11: // <sc
                            if (ch === "r" || ch === "R") {
                                state = 12;
                            } else {
                                state = 0;
                            }
                            break;
                        case 12: // <scr
                            if (ch === "i" || ch === "I") {
                                state = 13;
                            } else {
                                state = 0;
                            }
                            break;
                        case 13: // <scri
                            if (ch === "p" || ch === "P") {
                                state = 14;
                            } else {
                                state = 0;
                            }
                            break;
                        case 14: // <scrip
                            if (ch === "t" || ch === "T") {
                                injectScriptAtIndex(
                                    chunk,
                                    i + 1 - "<script".length
                                );
                                return;
                            } else {
                                state = 0;
                            }
                            break;
                    }
                }
                if (!injected) {
                    outStream.write(chunk, encoding);
                }
            }
        });
};
