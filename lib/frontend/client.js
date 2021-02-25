/* eslint-disable no-var */
(function() {
  "use strict";

  var liveStyleOptions = {
    reload: function() {
      window.location.reload();
    }
  }; // The options will be injected by the server

  window.liveStyle = liveStyleOptions; // Make it detectable on the client that livestyle is in use

  function sendRegistration(theSocket) {
    theSocket.json({
      type: "register",
      args: { pathname: window.location.pathname }
    });
  }

  var Sockette = window.sockette;
  // eslint-disable-next-line prefer-template
  var socket = new Sockette("ws://" + window.location.host + "/__livestyle", {
    timeout: 5000,
    onopen: function() {
      sendRegistration(socket);
    },
    onreconnect: function() {
      sendRegistration(socket);
    },
    onmessage: function(msg) {
      if (msg.data === "reload") {
        window.liveStyle.reload();
      }
    }
  });
})();
