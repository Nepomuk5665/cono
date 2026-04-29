package net.erstschlag.playground.twitch.eventsub.events;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import net.erstschlag.playground.PlaygroundEvent;

public class ChannelPollEvent extends PlaygroundEvent<ChannelPollEvent> {

    public record PollChoice(String id, String title, Optional<Integer> channelPointVotes, Optional<Integer> totalVotes) {}

    public enum TYPE {
        START,
        PROGRESS,
        END
    }

    private final TYPE eventType;

    private final String id;
    private final String title;
    private final List<PollChoice> pollChoices;
    private final Instant startedAt;
    private final Instant endsAt;
    private final int additionalVoteChannelPointCost;
    private final String status;

    public ChannelPollEvent(TYPE eventType, String id, String title,
            List<PollChoice> pollChoices, Instant startedAt, Instant endsAt,
            int additionalVoteChannelPointCost, String status) {
        super(Optional.empty());
        this.eventType = eventType;
        this.id = id;
        this.title = title;
        this.pollChoices = pollChoices;
        this.startedAt = startedAt;
        this.endsAt = endsAt;
        this.additionalVoteChannelPointCost = additionalVoteChannelPointCost;
        this.status = status;
    }

    public TYPE getEventType() {
        return eventType;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public List<PollChoice> getPollChoices() {
        return pollChoices;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getEndsAt() {
        return endsAt;
    }

    public int getAdditionalVoteChannelPointCost() {
        return additionalVoteChannelPointCost;
    }

    public String getStatus() {
        return status;
    }

    @Override
    public String toString() {
        return "ChannelPollEvent [eventType=" + eventType + ", id=" + id + ", title=" + title + ", pollChoices="
                + pollChoices + ", startedAt=" + startedAt + ", endsAt=" + endsAt + ", additionalVoteChannelPointCost="
                + additionalVoteChannelPointCost + ", status=" + status + "]";
    }

}
