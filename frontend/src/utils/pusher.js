import Pusher from 'pusher-js';

let instance = null;

export function getPusher() {
    if (!instance) {
        instance = new Pusher(process.env.REACT_APP_PUSHER_KEY || '', {
            cluster: process.env.REACT_APP_PUSHER_CLUSTER || 'us2',
        });
    }
    return instance;
}
