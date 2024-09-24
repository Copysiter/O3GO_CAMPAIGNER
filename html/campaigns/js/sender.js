window.initSender = function(id) {

    window.updateSenderInfo = function(status, last_activity) {
        switch (status) {
            case 0:
                $('#sender-status').text('Stopped');
                $('#sender-status').addClass("info-red");
                $('#sender-status').removeClass("info-green");
                $('#toolbar').data("kendoToolBar").hide($('#sender-stop'));
                $('#toolbar').data("kendoToolBar").show($('#sender-start'));
            break;
            case 1:
                $('#sender-status').text('Running');
                $('#sender-status').removeClass("info-red");
                $('#sender-status').addClass("info-green");
                $('#toolbar').data("kendoToolBar").show($('#sender-stop'));
                $('#toolbar').data("kendoToolBar").hide($('#sender-start'));
            break;
        }
        $('#sender-ts').text((last_activity ? last_activity : 'no information'));
    }

    window.updateSenderStatus = function(status) {
        let action = status == 1 ? 'start' : 'stop';
        kendo.confirm(`<div style='padding:5px 10px 0 10px;'>Are you sure you want to ${action[0].toUpperCase() + action.slice(1)} Sender?</div>`).done(function() {
            $.ajax({
                url: `${campaigner_api_addr}/api/v1/campaigner/${action}`,
                type: "POST",
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
                },
                success: function(data) {
                    
                },
                error: function(jqXHR, textStatus, ex) {
                    
                }
            }).then(function(data) {
                if (data.status !== 'undefined') {
                    updateSenderInfo(data.status, data.last_activity);
                    /*
                    $("#ports-notification").kendoNotification({
                        type: "warning",
                        position: {
                            top: 54,
                            right: 8
                        },
                        width: "auto",
                        allowHideAfter: 1000,
                        autoHideAfter: 5000
                    });
                    $("#ports-notification").getKendoNotification().show("Port has been " + (status_id == 1 ? "enabled" : "disabled"));
                    */
                }
            });
        }).fail(function() {
            
        });
    }

    window.getSender = function() {
        $.ajax({
            url: `${campaigner_api_addr}/api/v1/campaigner/`,
            type: "GET",
            beforeSend: function (xhr) {
                xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
            },
            success: function(data) {
                
            },
            error: function(jqXHR, textStatus, ex) {
                
            }
        }).then(function(data) {
            if (data.status !== undefined) {
                updateSenderInfo(data.status, data.last_activity);
            }
        });
        window.sender_timer = setTimeout(getSender, 60000);
    }

    getSender();

}