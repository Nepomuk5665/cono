package net.erstschlag.playground.kick;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "kick")
public class KickConfiguration {
    
    private String channelId;
    private String pusherKey;
    private String pusherCluster;

    public String getChannelId() {
        return channelId;
    }

    public void setChannelId(String channelId) {
        this.channelId = channelId;
    }

    public String getPusherKey() {
        return pusherKey;
    }

    public void setPusherKey(String pusherKey) {
        this.pusherKey = pusherKey;
    }

    public String getPusherCluster() {
        return pusherCluster;
    }

    public void setPusherCluster(String pusherCluster) {
        this.pusherCluster = pusherCluster;
    }

}
