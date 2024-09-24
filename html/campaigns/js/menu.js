window.initContextMenu = function() {
    
    $("#campaign-menu").kendoContextMenu({
        target: "#campaign-grid tbody",
        filter: "tr[role='row']",
        animation: false,
        dataSource: [
            {
                text: "Campaign Detail",
                cssClass: "editSim",
                spriteCssClass: "famfamfam-silk layers",
                attr: {
                    "onclick": "openCampaignDetail()"
                }
            },
            {
                text: "",
                cssClass: "k-separator",
            }, 
            {
                text: "Campaign Settings",
                cssClass: "editSim",
                spriteCssClass: "famfamfam-silk cog",
                attr: {
                    "onclick": "openCampaignEditForm()"
                }
            },
            {
                text: "",
                cssClass: "k-separator",
            }, 
            {
                text: "Start Campaign",
                cssClass: "editSim",
                //spriteCssClass: "famfamfam-silk tick",
                spriteCssClass: "famfamfam-silk accept",
                attr: {
                    "onclick": "updateCampaignStatus(1);"
                }
            },
            {
                text: "Stop Campaign",
                cssClass: "disableSim",
                //spriteCssClass: "famfamfam-silk cross",
                spriteCssClass: "famfamfam-silk delete",
                attr: {
                    "onclick": "updateCampaignStatus(0);"
                }
            },
            {
                text: "",
                cssClass: "k-separator",
            }, 
            {
                text: "Delete Campaign",
                cssClass: "disableSim",
                //spriteCssClass: "famfamfam-silk cut_red_ broom",
                spriteCssClass: "famfamfam-silk cross",
                attr: {
                    "onclick": "campaignDelete();"
                }
            }
        ],
        activate: function(e) {
            /*
            let response = await fetch(`${campaigner_api_addr}/api/v1/campaigns/${window.selectedCompaignId}`)
            window.selectedCampaignItem = await response.json()
            */
            let menu = this;
            let grid = $("#campaign-grid").data("kendoGrid");
            menu.enable("li", true);
            if (!$(e.target).is('.k-state-selected')) grid.clearSelection();
            grid.select(e.target);
            grid.trigger("change");
        },
        deactivate: function(e) {
        },
        select: function(e) {
        }
    });

}