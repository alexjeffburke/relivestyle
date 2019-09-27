(function() {
    "use strict";

    var Sockette = window.sockette;
    const ws = new Sockette("ws://" + window.location.host + "/__livestyle", {
        timeout: 500,
        onmessage: function(msg) {
            if (msg.data === "reload") {
                ws.close();
                window.location.reload();
            }
        }
    });
})();
