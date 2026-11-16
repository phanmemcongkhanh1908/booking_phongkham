// Service Worker for Dental Smart Booking & Clinic Admin Mobile Notifications
const CACHE_NAME = 'dental-smart-static-v3';

importScripts('/sw-push.js');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
