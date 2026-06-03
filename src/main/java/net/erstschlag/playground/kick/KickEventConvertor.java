package net.erstschlag.playground.kick;

import java.math.BigDecimal;
import java.util.Optional;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.erstschlag.playground.twitch.eventsub.events.ChannelMessageEvent;
import net.erstschlag.playground.user.UserDto;

public class KickEventConvertor {

    public static final ChannelMessageEvent parseChannelMessageEvent(String eventData) {
        JsonObject msg = JsonParser.parseString(eventData).getAsJsonObject();
        String sender   = msg.getAsJsonObject("sender").get("username").getAsString();
        String content  = msg.get("content").getAsString();
        String messageId = msg.get("id").getAsString();
        return new ChannelMessageEvent(buildKickUser(sender), content, Optional.of(messageId));
    }

    private static Optional<UserDto> buildKickUser(String senderName) {
        UserDto user = new UserDto();
        user.setId("kick_" + senderName);
        user.setName(senderName);
        user.setDisplayName(senderName);
        user.setNuggets(BigDecimal.ZERO);
        user.setWeeklyLP(0);
        user.setTotalLP(0);
        return Optional.of(user);
    }
}
