(function() {
    "use strict";

    var liveStyleOptions = {}; // The options will be injected by the server
    window.liveStyle = liveStyleOptions; // Make it detectable on the client that livestyle is in use

    var Sockette = window.sockette;
    var socket = new Sockette("ws://" + window.location.host + "/__livestyle", {
        timeout: 5e3,
        maxAttempts: 1,
        onopen: function() {
            socket.json({
                type: "register",
                args: { pathname: window.location.pathname }
            });
        },
        onmessage: function(msg) {
            if (msg.data === "reload") {
                window.location.reload();
            }
        }
    });
})();
