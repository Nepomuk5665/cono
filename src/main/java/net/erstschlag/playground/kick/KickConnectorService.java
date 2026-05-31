package net.erstschlag.playground.kick;

import org.springframework.stereotype.Service;

import com.pusher.client.Pusher;
import com.pusher.client.PusherOptions;
import com.pusher.client.channel.Channel;
import com.pusher.client.channel.PusherEvent;

import jakarta.annotation.PostConstruct;

@Service
public class KickConnectorService {

    private static final String PUSHER_KEY = "32cbd69e4b950bf97679";
    private static final String PUSHER_CLUSTER = "us2";
    private static final long KICK_CHATROOM_ID = 63321745l;

    private Pusher kickPusher;

    public KickConnectorService() {
       
    }

    @PostConstruct
    public void init() {
        initialize();
    }

    private void initialize() {
        shutdownKickPusher();
        PusherOptions options = new PusherOptions().setCluster(PUSHER_CLUSTER);
        kickPusher = new Pusher(PUSHER_KEY, options);
        kickPusher.connect();
        Channel channel = kickPusher.subscribe("chatrooms." + KICK_CHATROOM_ID + ".v2");
        channel.bind("App\\Events\\ChatMessageEvent", (PusherEvent event) -> {
            System.out.println("New message: " + event.getData());
        });
    }

    private void shutdownKickPusher() {
        if (kickPusher != null) {
            try {
                kickPusher.disconnect();
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                kickPusher = null;
            }
        }
    }

}
