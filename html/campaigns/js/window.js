window.initWindow = function() {

    $("#campaign-window").kendoWindow({
        modal: false,
        position: {
            top: 0,
            left: 0
        },
        width: '100%',
        height: '100%',
        opacity: 0.1,
        visible: false,
        animation: false,
        draggable: false,
        resizable: false,
        scrollable: false,
        appendTo: "#content",
        title: 'Campaign Details',
        // content: "Тестовый контент",
        actions: [/*"Custom", "Minimize", "Maximize", */"Close"],
        open: function(e) {
            
        },
        close: function() {
            $('#message-grid').empty();
            if (window.messageTimer) clearTimeout(messageTimer);
            if (window.campaign_stat_timer) clearTimeout(campaign_stat_timer);
        }
    }).data("kendoWindow");


    $("#campaign-create-window").kendoWindow({
        modal: true,
        width: 768,
        height: 'auto',
        maxHeight: '90%',
        opacity: "0.1",
        visible: false,
        animation: false,
        draggable: true,
        resizable: false,
        appendTo: "body",
        title: 'New Campaign',
        actions: [/*"Custom", "Minimize", "Maximize", */"Close"],
        open: function(e) {
            //campaignCreateModel.data.set("data_file_name", null);
            //console.log(campaignCreateModel);
        },
        close: function(e) {
            resetWizard();

            // console.log(wizard_data_blank);
            // wizardModel.set("data", wizard_data_blank);
            // console.log(wizardModel.data);
            // $("#wizard").data("kendoWizard").select(0);
            // for (let key in wizard_data_blank) {
            //     wizardModel.data.set(key, wizard_data_blank[key]);
            // }
            /*
            $("#wizard").empty();
            initWizard();
            */
           
            //wizardModel.set("data", Object.assign({}, wizardModel.blank));
        }

        // close: function(e) {
        //     $("#campaigner-form").data("kendoForm").clear();
        //     window.selectedUserIds = []
        // },
    }).data("kendoWindow");
    // let newCampaign = $("#newCampaign-window").data("kendoWindow")
    // newCampaign.maximize()

    $("#campaign-edit-window").kendoWindow({
        modal: true,
        width: 768,
        height: 'auto',
        maxHeight: '90%',
        opacity: "0.1",
        visible: false,
        animation: false,
        draggable: true,
        resizable: false,
        title: false,
        appendTo: "body",
        title: 'Edit Campaign',
        actions: [/*"Custom", "Minimize", "Maximize", */"Close"],
        open: function(e) {
            
        },
        close: function() {
           
        }
    }).data("kendoWindow");

}
