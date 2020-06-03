self.addEventListener('push', function(event) {
  if (event.data) {
    console.log('This push event has data: ');
    console.log(event.data.text());
  } else {
    console.log('This push event has no data.');
  }
  var myData = event.data.json();
  const promiseChain = self.registration.showNotification(myData.title, {body: myData.body});
  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  var digiUrl = 'https://www.digiacesso.net';
  clients.openWindow(digiUrl);
});

