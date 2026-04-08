package net.erstschlag.playground.twitch.eventsub.events;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import net.erstschlag.playground.PlaygroundEvent;

public class ChannelPredictionEvent extends PlaygroundEvent<ChannelPredictionEvent> {

    public record PredctionOutcome(String id, String title, COLOR color, Optional<Integer> numberOfUsers, Optional<Long> channelPointsSpent,
            List<Predictor> topPredictors) {
        public enum COLOR {
            BLUE,
            PINK
        }
    }

    public record Predictor(String userDisplayName, Optional<Integer> channelPointsWon, int channelPointsUsed) {
    }

    public enum TYPE {
        START,
        PROGRESS,
        LOCKED,
        END
    }

    private final TYPE eventType;
    private final String id;
    private final String title;
    private final List<PredctionOutcome> outcomes;
    private final Instant startedAt;
    private final Optional<Instant> locksAt;
    private final Optional<Instant> endedAt;
    private final Optional<String> winningOutcomeId;

    public ChannelPredictionEvent(TYPE eventType, String id, String title, List<PredctionOutcome> outcomes,
            Instant startedAt, Optional<Instant> locksAt, Optional<Instant> endedAt, Optional<String> winningOutcomeId) {
        super(Optional.empty());
        this.eventType = eventType;
        this.id = id;
        this.title = title;
        this.outcomes = outcomes;
        this.startedAt = startedAt;
        this.locksAt = locksAt;
        this.endedAt = endedAt;
        this.winningOutcomeId = winningOutcomeId;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public List<PredctionOutcome> getOutcomes() {
        return outcomes;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Optional<Instant> getLocksAt() {
        return locksAt;
    }

    public Optional<Instant> getEndedAt() {
        return endedAt;
    }

    public Optional<String> getWinningOutcomeId() {
        return winningOutcomeId;
    }

    public TYPE getEventType() {
        return eventType;
    }

    @Override
    public String toString() {
        return "ChannelPredictionEvent [eventType=" + eventType + ", id=" + id + ", title=" + title + ", outcomes="
                + outcomes + ", startedAt=" + startedAt + ", locksAt=" + locksAt + ", endedAt=" + endedAt
                + ", winningOutcomeId=" + winningOutcomeId + "]";
    }

}
