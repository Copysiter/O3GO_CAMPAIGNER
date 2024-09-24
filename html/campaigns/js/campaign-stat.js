window.initCampaignStat = function() {

    $("#campaign-sent-progress").kendoProgressBar({
        showStatus: true,
        max: 100,
        value: 0,
        type: "percent",
        animation: false,
        change: function(e) {
            //this.progressStatus.text(`${window.selectedCampaignItem.msg_sent === null ? 0 : window.selectedCampaignItem.msg_sent} / ${window.selectedCampaignItem.msg_total}`);
            this.progressWrapper.css({
                //"background-color": "#eac05d",
                "background-color": "#5faede",
                //"border-color": "#eac05d"
            });
        }
    });

    $("#campaign-delivered-progress").kendoProgressBar({
        showStatus: true,
        max: 100,
        value: 0,
        type: "percent",
        animation: false,
        change: function(e) {
          //this.progressStatus.text(`${window.selectedCampaignItem.msg_delivered === null ? 0 : window.selectedCampaignItem.msg_delivered} / ${window.selectedCampaignItem.msg_total}`);
          this.progressWrapper.css({
            "background-color": "#79c979",
            //"border-color": "#79c979"
          });
        }
    });

    $("#campaign-failed-progress").kendoProgressBar({
        showStatus: true,
        max: 100,
        value: 0,
        type: "percent",
        animation: false,
        change: function(e) {
            //this.progressStatus.text(`${window.selectedCampaignItem.msg_failed === null ? 0 : window.selectedCampaignItem.msg_failed} / ${window.selectedCampaignItem.msg_total}`);
            this.progressWrapper.css({
                "background-color": "#e97b81",
                //"border-color": "#e97b81"
            });
        }
    });

    $(".expansion-panel").each(function() {
        $(this).kendoExpansionPanel({
            title: $(this).attr("data-title"),
            expanded: true,
            animation: false,
            expand: function(e) {

            }
        });
    });

}
