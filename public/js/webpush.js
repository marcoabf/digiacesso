
function notifyMe() {

    if (!('serviceWorker' in navigator)) {
      // Service Worker isn't supported on this browser, disable or hide UI.
      console.log('Service worker não é suportado');
      return;
    } else { console.log('Service worker suportado!');}
    
    if (!('PushManager' in window)) {
      // Push isn't supported on this browser, disable or hide UI.
      console.log('Push não é suportado');
      return;
    } else {  console.log('Push é suportado');}
  
    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
      console.log("Esse navegador não suporta notificação");
    }
    // Let's check whether notification permissions have alredy been granted
    else if (Notification.permission === "granted") {
      // If it's okay let's create a notification
      console.log("Esse navegador suporta notificação");
      var notification = new Notification("Olá! Notificação teste!");
    }
    // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== 'denied' || Notification.permission === "default") {
      Notification.requestPermission(function (permission) {
        // If the user accepts, let's create a notification
        if (permission === "granted") {
          var notification = new Notification("Olá! Primeira notificação!");
        }
      });
    }
    subscribeUserToPush();
  }
  
  function subscribeUserToPush() {
    return navigator.serviceWorker.register('/js/sw.js')
    .then(function(registration) {
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BIwuuXK7vJ_QvxDTmOp-sLDkCRV8gZJst02gtPg5C4KhgqUoD9_UuY1T3yzacCqnSN6GGpx4WhKku_GX65T-rhA'
        )
      };
      return registration.pushManager.subscribe(subscribeOptions);
    })
    .then(function(pushSubscription) {
      console.log('Received PushSubscription: ', JSON.stringify(pushSubscription));
      return pushSubscription;
    });
  }
  
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
   
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
   
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  
