// A minimal service worker to trick Chrome into firing the install prompt
self.addEventListener('fetch', function(event) {});