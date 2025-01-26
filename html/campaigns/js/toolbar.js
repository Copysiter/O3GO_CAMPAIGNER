window.initToolbar = function() {

    $("#campaign-toolbar").kendoToolBar({
        items: [{
                template: "<div class='k-window-title ps-6'>Campaigns</div>",
            }, {
                type: "spacer"
            }, {
                type: "button",
                text: "Refresh",
                click: function(e) {
                    $("#campaign-grid").data("kendoGrid").dataSource.read();
                }
            }, {
                type: "button",
                text: "Clear Filter",
                click: function(e) {
                    $("#campaign-grid").data("kendoGrid").dataSource.filter({});
                }
            }, {
                type: "button",
                text: "New Campaign",
                icon: "plus",
                click: function(e) {
                    $("#campaign-create-window").data("kendoWindow").center().open();
                }
            }]
    });

    $("#campaign-detail-toolbar").kendoToolBar({
        items: [{
                template: "<span class=''>Status:</span>",
            }, {
                template: "<span id='campaign-status' class='info info-light'>wait info...</span>",
            }, { 
                type: "separator"
            }, { 
                type: "button",
                id: "campaign-start",
                text: "Start campaign",
                icon: "arrow-60-right", 
                hidden: false,
                click: function() {
                    updateCampaignStatus(1);
                }
            }, { type: "button",
                text: "Stop campaign",
                id: "campaign-stop",
                icon: "stop",
                hidden: false,
                click: function() {
                    updateCampaignStatus(0);
                }
            }/*, {   
                type: "button",
                text: "Copy",
                icon: "plus-sm",
                click: function() {
                    
                }
            }*/, { 
                type: "separator"
            }, { 
                type: "button",
                // icon: "cog" 
                text: "Settings",
                click: function() {
                    openCampaignEditForm();
                }
            }, {
                type: "spacer"
            }, {
                type: "button",
                text: "Clear Filter",
                click: function(e) {
                    $("#message-grid").data("kendoGrid").dataSource.filter({});
                }
            }, {
                type: "button",
                text: "Refresh",
                click: function(e) {
                    clearTimeout(campaign_stat_timer);
                    getCampaignStat(selectedCampaignItem.id);
                    $("#message-grid").data("kendoGrid").dataSource.read();
                }
            }, {
                type: "button",
                text: "Export to Excel",
                click: function() {
                    exportCampaignReport(selectedCampaignItem.id);
                }
            }, {
                type: "separator"
            }, {
                type: "button",
                themeColor: "error",
                fillMode: "outline",
                text: "Clear campaign",
                click: function() {
                    campaignClear(selectedCampaignItem.id);
                }
            }, {
                type: "button",
                themeColor: "error",
                //icon: "close-circle",
                text: "Delete campaign",
                click: function() {
                    campaignDelete(selectedCampaignItem.id);
                }
            },
        ]
    });
    /*
    $('#campaign-title').kendoToolBar({
        items: [
            {
                template: `<div class='toolbarBlock'><h4 id="toolbar-template" class='title'></h4></div>`
            }
        ]
    });
    */
}
