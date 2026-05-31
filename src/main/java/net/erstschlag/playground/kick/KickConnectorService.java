package net.erstschlag.playground.kick;

import java.util.Optional;
import java.util.StringTokenizer;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.pusher.client.Pusher;
import com.pusher.client.PusherOptions;
import com.pusher.client.channel.Channel;
import com.pusher.client.channel.PusherEvent;

import jakarta.annotation.PostConstruct;
import net.erstschlag.playground.PlaygroundEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChannelMessageEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChatMessageEvent;
import net.erstschlag.playground.twitch.eventsub.events.RaffleEvent;

@Service
public class KickConnectorService {

    private static final String PUSHER_KEY = "32cbd69e4b950bf97679";
    private static final String PUSHER_CLUSTER = "us2";
    private static final long KICK_CHATROOM_ID = 63321745l;

    private final ApplicationEventPublisher applicationEventPublisher;

    private Pusher kickPusher;

    public KickConnectorService(ApplicationEventPublisher applicationEventPublisher) {
       this.applicationEventPublisher = applicationEventPublisher;
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
            handleChatMessageEvent(KickEventConvertor.parseChannelMessageEvent(event.getData()));
        });
    }

    private void handleChatMessageEvent(ChannelMessageEvent event) {
        String eventMessage = event.getMessage();
        if (eventMessage != null) {
            if (eventMessage.startsWith("!raffle")) {
                handleRaffleChatMessage(event);
                return;
            }
            handleChatMessage(event, eventMessage);
        }
    }

    private void handleRaffleChatMessage(ChannelMessageEvent event) {
        Optional<String> raffleArg1 = Optional.empty();
        StringTokenizer strTok = new StringTokenizer(event.getMessage(), " ");
        if (strTok.countTokens() >= 2) {
            strTok.nextToken();
            raffleArg1 = Optional.of(strTok.nextToken());
        }
        publishApplicationEvent(new RaffleEvent(event.getUser(), raffleArg1));
    }

    private void handleChatMessage(ChannelMessageEvent event, String message) {
        publishApplicationEvent(new ChatMessageEvent(event.getUser(), message));
    }

    private <T extends PlaygroundEvent> T publishApplicationEvent(T playgroundEvent) {
        applicationEventPublisher.publishEvent(playgroundEvent);
        System.out.println(playgroundEvent.toString());
        return playgroundEvent;
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
