window.openCampaignDetail = function() {
    if (window.selectedCampaignItem) {
        updateCampaignStat(selectedCampaignItem);
        initMessageGrid(selectedCampaignItem.id);
        $("#campaign-window").data("kendoWindow").setOptions({
            title: selectedCampaignItem.name ? selectedCampaignItem.name : ""
        });
        $("#campaign-window").data("kendoWindow").open();
    }
}

window.openCampaignEditForm = function() {
    if (window.selectedCampaignItem) {
        let form = $('#campaign-edit-form').data('kendoForm');
        let values = {};
        Object.assign(values, window.selectedCampaignItem);
        values.ID = window.selectedCampaignItem.id;
        values.tags = window.selectedCampaignItem.tags.map(({ id }) => id);
        form.setOptions({
            formData: values
        });
        $('#campaign-edit-schedule').scheduler({
            data: selectedCampaignItem.schedule,
            onSelect: function (data) {
                form._model.schedule = data;
            }
        });
        $('#campaign-edit-window').data('kendoWindow').setOptions({
            title: `Edit Campaign (${values.name})`,
        });
        $("#campaign-edit-window").data('kendoWindow').open().center();
    }
}

window.campaignUpdate = function(data) {
    let dataItem = $("#campaign-grid").data("kendoGrid").dataItem($("#campaign-grid").data("kendoGrid").select());
    for (const key in data) {
        dataItem[key] = data[key];
    }
    $("#campaign-grid").data("kendoGrid").refresh();
}

window.campaignUpdateRows = function(data) {
    let rows = $("#campaign-grid").data("kendoGrid").select()
    for (let i = 0; i < rows.length; i++) {
        let dataItem = $("#campaign-grid").data("kendoGrid").dataItem(rows[i]);
        for (const key in data[dataItem['id']]) {
            dataItem[key] = data[dataItem['id']][key];
        }
    }
    $("#campaign-grid").data("kendoGrid").refresh();
}

window.getCampaignStat = function(id) {
    $.ajax({
        url: `http://${api_base_url}/api/v1/campaigns/${id}`,
        type: "GET",
        beforeSend: function (xhr) {
            xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
        },
        success: function(data) {
            
        },
        error: function(jqXHR, textStatus, ex) {
            
        }
    }).then(function(data) {
        if (data.id !== undefined) {
            updateCampaignStat(data);
        }
    });
}

window.updateCampaignStat = function(item) {
    if (window.campaign_stat_timer) clearTimeout(campaign_stat_timer);
    switch (item.status) {
        case 0:
            $('#campaign-status').text('Created');
            $('#campaign-status').removeClass("info-blue");
            $('#campaign-status').removeClass("info-green");
            $('#campaign-status').removeClass("info-red");
            $('#campaign-status').addClass("info-light");
            $('#campaign-start').show();
            $('#campaign-stop').hide();
        break;
        case 1:
            $('#campaign-status').text('Running');
            $('#campaign-status').removeClass("info-blue");
            $('#campaign-status').addClass("info-green");
            $('#campaign-status').removeClass("info-red");
            $('#campaign-status').removeClass("info-light");
            $('#campaign-start').hide();
            $('#campaign-stop').show();
        break;
        case 2:
            $('#campaign-status').text('Stopped');
            $('#campaign-status').removeClass("info-blue");
            $('#campaign-status').removeClass("info-green");
            $('#campaign-status').addClass("info-red");
            $('#campaign-status').removeClass("info-light");
            $('#campaign-start').show();
            $('#campaign-stop').hide();
        break;
        case 3:
            $('#campaign-status').text('Complete');
            $('#campaign-status').addClass("info-blue");
            $('#campaign-status').removeClass("info-green");
            $('#campaign-status').removeClass("info-red");
            $('#campaign-status').removeClass("info-light");
            $('#campaign-start').show();
            $('#campaign-stop').hide();
        break;
    }

    $("#campaign-sent-progress").data("kendoProgressBar").value((item.msg_total > 0 ? item.msg_sent / item.msg_total * 100 : 0));
    $("#campaign-delivered-progress").data("kendoProgressBar").value((item.msg_total > 0 ? item.msg_delivered / item.msg_total * 100 : 0));
    $("#campaign-undelivered-progress").data("kendoProgressBar").value((item.msg_total > 0 ? item.msg_undelivered / item.msg_total * 100 : 0));
    $("#campaign-failed-progress").data("kendoProgressBar").value((item.msg_total > 0 ? item.msg_failed / item.msg_total * 100 : 0));

    $('#campaign-msg-total').html(`${item.msg_total === null ? 0
        : item.msg_total}`);
    $('#campaign-msg-sent').html(`${item.msg_sent === null ? 0 
        : item.msg_sent}`);
    $('#campaign-msg-delivered').html(`${item.msg_delivered === null ? 0 
        : item.msg_delivered}`);
    $('#campaign-msg-undelivered').html(`${item.msg_undelivered === null ? 0 
        : item.msg_undelivered}`);
    $('#campaign-msg-failed').html(`${item.msg_failed === null ? 0 
        : item.msg_failed}`);

    $('#campaign-sms-sent').html(`${item.msg_sent === null ? 0 
        : item.msg_sent * item.msg_parts}`);
    $('#campaign-sms-delivered').html(`${item.msg_delivered === null ? 0 
        : item.msg_delivered * item.msg_parts}`);
    $('#campaign-sms-failed').html(`${item.msg_failed === null ? 0 
        : item.msg_failed * item.msg_parts}`);
    
    $('#campaign-created').html(`${item.create_ts === null ? 0
        : kendo.toString(item.create_ts, 'yyyy-MM-dd HH:mm:ss')}`);
    $('#campaign-started').html(`${item.start_ts === null ? 0
        : kendo.toString(item.start_ts, 'yyyy-MM-dd HH:mm:ss')}`);
    $('#campaign-stopped').html(`${item.stop_ts === null ? 0
        : kendo.toString(item.stop_ts, 'yyyy-MM-dd HH:mm:ss')}`);

    window.campaign_stat_timer = setTimeout(function() {
        getCampaignStat(item.id);
    }, 60000);
}

window.updateCampaignStatus = function(status) {
    const action = status == 1 ? 'start' : (status == 2 ? 'pause' : 'stop');
    if (window.selectedCampaignItems.length > 1) {
        kendo.confirm(`<div style='padding:5px 10px 0 10px;'>Are you sure you want to ${action} Campaigns?</div>`).done(function () {
            $.ajax({
                url: `http://${api_base_url}/api/v1/campaigns/${action}`,
                type: "POST",
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({ids: window.selectedCampaignItems.map(obj => parseInt(obj.id))}),
                dataType: 'json',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", `${token_type} ${access_token}`);
                },
                success: function (data) {

                },
                error: function (jqXHR, textStatus, ex) {

                }
            }).then(function (data) {
                if (data.length > 0) {
                    campaignUpdateRows(Object.fromEntries(data.map(item => [item.id, item])));
                }
            });
        }).fail(function () {

        });
    } else {
        kendo.confirm(`<div style='padding:5px 10px 0 10px;'>Are you sure you want to ${action} Campaign?</div>`).done(function () {
            $.ajax({
                url: `http://${api_base_url}/api/v1/campaigns/${window.selectedCampaignItem.id}/${action}`,
                type: "POST",
                beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", `${token_type} ${access_token}`);
                },
                success: function (data) {

                },
                error: function (jqXHR, textStatus, ex) {

                }
            }).then(function (data) {
                if (data.id) {
                    campaignUpdate(data);
                    updateCampaignStat(data);
                    if (window.campaign_stat_timer) {
                        clearTimeout(campaign_stat_timer);
                        updateCampaignStat(data);
                    }
                }
            });
        }).fail(function () {

        });
    }
}

window.campaignDelete = function() {
    if (window.selectedCampaignItems.length > 1) {
        kendo.confirm(`<div style='padding:5px 10px 0 10px;'>Are you sure you want to delete Campaigns ?</div>`).done(function() {
            $.ajax({
                url: `http://${api_base_url}/api/v1/campaigns/`,
                type: "DELETE",
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({ids: window.selectedCampaignItems.map(obj => parseInt(obj.id))}),
                dataType: 'json',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
                },
                success: function(data) {

                },
                error: function(jqXHR, textStatus, ex) {

                }
            }).then(function(data) {
                if (data) {
                    $("#campaign-notification").kendoNotification({
                        type: "warning",
                        position: {
                            top: 54,
                            right: 8
                        },
                        width: "auto",
                        allowHideAfter: 1000,
                        autoHideAfter: 5000
                    });
                    let rows = $("#campaign-grid").data("kendoGrid").select();
                    for (let i = 0; i < rows.length; i++) {
                        $("#campaign-grid").data("kendoGrid").removeRow($(rows[i]));
                    }
                    $("#campaign-grid").data("kendoGrid").refresh();
                    $("#campaign-window").data("kendoWindow").close();
                    $("#campaign-notification").getKendoNotification().show("Campaigns haму been deleted.");
                }
            });
        }).fail(function() {

        });
    } else if (window.selectedCampaignItem) {
        kendo.confirm(`<div style='padding:5px 10px 0 10px;'>Are you sure you want to delete Campaign ?</div>`).done(function() {
            $.ajax({
                url: `http://${api_base_url}/api/v1/campaigns/${selectedCampaignItem.id}`,
                type: "DELETE",
                beforeSend: function (xhr) {
                    xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
                },
                success: function(data) {
                    
                },
                error: function(jqXHR, textStatus, ex) {
                    
                }
            }).then(function(data) {
                if (data.id) {
                    $("#campaign-notification").kendoNotification({
                        type: "warning",
                        position: {
                            top: 54,
                            right: 8
                        },
                        width: "auto",
                        allowHideAfter: 1000,
                        autoHideAfter: 5000
                    });
                    $("#campaign-grid").data("kendoGrid").removeRow($("#campaign-grid").data("kendoGrid").select());
                    $("#campaign-grid").data("kendoGrid").refresh();
                    $("#campaign-window").data("kendoWindow").close();
                    $("#campaign-notification").getKendoNotification().show("Campaign has been deleted.");
                }
            });
        }).fail(function() {
            
        });
    }
}

window.campaignClear = function() {
    kendo.confirm(`<div style='padding:5px 10px 0 10px;'>Are you sure you want to clear Campaign ?</div>`).done(function() {
        $.ajax({
            url: `http://${api_base_url}/api/v1/campaigns/${selectedCampaignItem.id}/campaign_dst`,
            type: "DELETE",
            beforeSend: function (xhr) {
                xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
            },
            success: function(data) {

            },
            error: function(jqXHR, textStatus, ex) {

            }
        }).then(function(data) {
            if (data.id) {
                $("#campaign-notification").kendoNotification({
                    type: "warning",
                    position: {
                        top: 54,
                        right: 8
                    },
                    width: "auto",
                    allowHideAfter: 1000,
                    autoHideAfter: 5000
                });
                // $("#campaign-window").data("kendoWindow").close();
                $("#message-grid").data("kendoGrid").dataSource.read();
                $("#campaign-grid").data("kendoGrid").dataSource.read();
                $("#campaign-notification").getKendoNotification().show("Campaign has been cleared.");
            }
        });
    }).fail(function() {

    });
}

window.exportCampaignReport = function(id) {
    kendo.confirm(`<div style='padding:5px 10px 0 10px;'>Download campaign report?</div>`).done(function() {
        window.open(`http://${api_base_url}/api/v1/campaigns/${id}/report`, '_blank');
        // window.location.href = `http://${api_base_url}/api/v1/campaigns/${id}/report`
    }).fail(function() {

    });
}