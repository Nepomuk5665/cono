package net.erstschlag.playground.twitch.eventsub;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import net.erstschlag.playground.twitch.eventsub.events.ChannelBitsEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChannelGiftedSubscriptionsEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChannelMessageEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChannelPollEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChannelPredictionEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChannelSubscribeEvent;
import net.erstschlag.playground.twitch.eventsub.events.RewardRedeemedEvent;
import net.erstschlag.playground.twitch.eventsub.events.ChannelPredictionEvent.PredctionOutcome.COLOR;
import net.erstschlag.playground.user.UserDto;
import net.erstschlag.playground.user.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.github.twitch4j.eventsub.domain.PredictionColor;

@Component
public class EventConvertor {

    private final UserService userService;

    @Autowired
    public EventConvertor(UserService userService) {
        this.userService = userService;
    }

    public RewardRedeemedEvent convert(
            com.github.twitch4j.eventsub.events.ChannelPointsCustomRewardRedemptionEvent cPCRRE) {
        System.out.println(cPCRRE.toString());
        return new RewardRedeemedEvent(extractUser(cPCRRE),
                cPCRRE.getReward().getTitle(),
                cPCRRE.getUserInput(),
                cPCRRE.getReward().getCost());
    }

    public ChannelBitsEvent convert(com.github.twitch4j.eventsub.events.ChannelCheerEvent cCE) {
        System.out.println(cCE.toString());
        return new ChannelBitsEvent(extractUser(cCE),
                cCE.getBits(),
                cCE.getMessage());
    }

    public ChannelBitsEvent convertToBitsEvent(com.github.twitch4j.eventsub.events.ChannelChatMessageEvent cCME) {
        System.out.println(cCME.toString());
        assert (cCME.getCheer() != null);
        return new ChannelBitsEvent(extractUser(cCME),
                cCME.getCheer().getBits(),
                cCME.getMessage() != null ? cCME.getMessage().getText() : null);
    }

    public ChannelSubscribeEvent convert(com.github.twitch4j.eventsub.events.ChannelSubscriptionMessageEvent cSME) {
        System.out.println(cSME.toString());
        return new ChannelSubscribeEvent(extractUser(cSME),
                false,
                SubTier.fromSubPlan(cSME.getTier()));
    }

    public ChannelSubscribeEvent convert(com.github.twitch4j.eventsub.events.ChannelSubscribeEvent cSE) {
        System.out.println(cSE.toString());
        return new ChannelSubscribeEvent(extractUser(cSE),
                false,
                SubTier.fromSubPlan(cSE.getTier()));
    }

    public ChannelGiftedSubscriptionsEvent convert(
            com.github.twitch4j.eventsub.events.ChannelSubscriptionGiftEvent cSGE) {
        System.out.println(cSGE.toString());
        return new ChannelGiftedSubscriptionsEvent(extractUser(cSGE),
                SubTier.fromSubPlan(cSGE.getTier()),
                cSGE.getTotal());
    }

    public ChannelMessageEvent convert(com.github.twitch4j.eventsub.events.ChannelChatMessageEvent cCME) {
        System.out.println(cCME.toString());
        assert (cCME.getCheer() == null);
        return new ChannelMessageEvent(extractUser(cCME),
                cCME.getMessage().getText(), // TODO: sanitize
                Optional.ofNullable(cCME.getMessageId()));
    }

    public ChannelPredictionEvent convert(com.github.twitch4j.eventsub.events.ChannelPredictionBeginEvent cPBE) {
        return convert(ChannelPredictionEvent.TYPE.START, cPBE, Optional.of(cPBE.getLocksAt()), Optional.empty(), Optional.empty());
    }
    public ChannelPredictionEvent convert(com.github.twitch4j.eventsub.events.ChannelPredictionProgressEvent cPPE) {
        return convert(ChannelPredictionEvent.TYPE.PROGRESS, cPPE, Optional.of(cPPE.getLocksAt()), Optional.empty(), Optional.empty());
    }
    public ChannelPredictionEvent convert(com.github.twitch4j.eventsub.events.ChannelPredictionLockEvent cPLE) {
        return convert(ChannelPredictionEvent.TYPE.LOCKED, cPLE, Optional.of(cPLE.getLockedAt()), Optional.empty(), Optional.empty());
    }
    public ChannelPredictionEvent convert(com.github.twitch4j.eventsub.events.ChannelPredictionEndEvent cPEE) {
        return convert(ChannelPredictionEvent.TYPE.END, cPEE, Optional.empty(), Optional.of(cPEE.getEndedAt()), Optional.of(cPEE.getWinningOutcomeId()));
    }

    private ChannelPredictionEvent convert(ChannelPredictionEvent.TYPE type,
            com.github.twitch4j.eventsub.events.ChannelPredictionEvent cPE, Optional<Instant> locksAt, Optional<Instant> endedAt, Optional<String> winningOutcomeId) {
        List<ChannelPredictionEvent.PredctionOutcome> outcomes = new ArrayList<>();
        for (com.github.twitch4j.eventsub.domain.PredictionOutcome outcome : cPE.getOutcomes()) {
            List<ChannelPredictionEvent.Predictor> topPredictors = new ArrayList<>();
            if(outcome.getTopPredictors() != null) {
                for (com.github.twitch4j.eventsub.domain.Predictor predictor : outcome.getTopPredictors()) {
                    topPredictors.add(new ChannelPredictionEvent.Predictor(predictor.getUserName(),
                            Optional.ofNullable(predictor.getChannelPointsWon()),
                            predictor.getChannelPointsUsed()));
                }
            }
            ChannelPredictionEvent.PredctionOutcome.COLOR outcomeColor = COLOR.BLUE;
            if (outcome.getColor() == PredictionColor.PINK) {
                outcomeColor = COLOR.PINK;
            }
            outcomes.add(new ChannelPredictionEvent.PredctionOutcome(outcome.getId(),
                    outcome.getTitle(),
                    outcomeColor,
                    Optional.ofNullable(outcome.getUsers()),
                    Optional.ofNullable(outcome.getChannelPoints()),
                    topPredictors));
        }
        return new ChannelPredictionEvent(type, cPE.getPredictionId(), cPE.getTitle(), outcomes, cPE.getStartedAt(), locksAt, endedAt, winningOutcomeId);
    }

    public ChannelPollEvent convert(com.github.twitch4j.eventsub.events.ChannelPollBeginEvent cPBE) {
        return convert(ChannelPollEvent.TYPE.START, cPBE, cPBE.getEndsAt(), null);
    }

    public ChannelPollEvent convert(com.github.twitch4j.eventsub.events.ChannelPollProgressEvent cPPE) {
        return convert(ChannelPollEvent.TYPE.PROGRESS, cPPE, cPPE.getEndsAt(), null);
    }

    public ChannelPollEvent convert(com.github.twitch4j.eventsub.events.ChannelPollEndEvent cPEE) {
        String status = cPEE.getStatus() != null ? cPEE.getStatus().toString().toLowerCase() : null;
        return convert(ChannelPollEvent.TYPE.END, cPEE, cPEE.getEndedAt(), status);
    }

    private ChannelPollEvent convert(ChannelPollEvent.TYPE eventType,
            com.github.twitch4j.eventsub.events.ChannelPollEvent cPE, Instant endsAt, String status) {
        List<ChannelPollEvent.PollChoice> pollChoices = new ArrayList<>();
        int additionalVoteChannelPointCost = 0;
        if (cPE.getChannelPointsVoting().isEnabled()) {
            additionalVoteChannelPointCost = cPE.getChannelPointsVoting().getAmountPerVote();
        }
        for (com.github.twitch4j.eventsub.domain.PollChoice t4jPollChoice : cPE.getChoices()) {
            pollChoices.add(new ChannelPollEvent.PollChoice(
                    t4jPollChoice.getId(),
                    t4jPollChoice.getTitle(),
                    Optional.ofNullable(t4jPollChoice.getChannelPointsVotes()),
                    Optional.ofNullable(t4jPollChoice.getVotes())));
        }
        return new ChannelPollEvent(eventType,
                cPE.getPollId(),
                cPE.getTitle(),
                pollChoices,
                cPE.getStartedAt(),
                endsAt,
                additionalVoteChannelPointCost,
                status);
    }

    private Optional<UserDto> extractUser(com.github.twitch4j.eventsub.events.EventSubUserChannelEvent eSUCE) {
        if (eSUCE.getUserId() == null) {
            return Optional.empty();
        }
        return Optional
                .ofNullable(userService.getOrCreateUser(eSUCE.getUserId(), eSUCE.getUserLogin(), eSUCE.getUserName()));
    }

    private Optional<UserDto> extractUser(com.github.twitch4j.eventsub.events.ChannelChatUserEvent cCUE) {
        if (cCUE.getChatterUserId() == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(userService.getOrCreateUser(cCUE.getChatterUserId(), cCUE.getChatterUserLogin(),
                cCUE.getChatterUserName()));
    }
}
