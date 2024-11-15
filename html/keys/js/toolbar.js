window.initToolbar = function() {
    $('#keys-toolbar').kendoToolBar({
        items: [
            {
                template: "<div class='k-window-title ps-6'>API Keys</div>",
            },
            {
                type: 'spacer',
            },
            {
                type: 'button',
                id: 'delete',
                text: 'Delete',
                icon: 'cancel',
                hidden: true,
                attributes: { 'class': 'k-button-solid-error' },
                click: function (e) {
                    // $('#keys-grid').data('kendoGrid').dataSource.read();
                    let grid = $('#keys-grid').data('kendoGrid');
                    let rows = grid.select();
                    let ids = []
                    for (let i = 0; i < rows.length; i++) {
                        let dataItem = grid.dataItem($(rows[i]));
                        ids.push(dataItem.id);
                    }
                    kendo.confirm("<div style='padding:5px 10px 0 10px;'>Are you sure you want to delete keys?</div>").done(function() {
                        $.ajax({
                            url: `http://${api_base_url}/api/v1/api_keys/delete`,
                            type: "POST",
                            data: JSON.stringify({ ids: ids }),
                            processData: false,
                            ContentType: 'application/json',
                            headers: {
                                'Content-Type': 'application/json; odata=verbose'
                            },
                            success: function(data) {

                            },
                            error: function(jqXHR, textStatus, ex) {

                            }
                        }).then(function(data) {
                            if (!data.error) {
                                /*
                                $("#keys-notification").kendoNotification({
                                    type: "warning",
                                    position: {
                                        top: 54,
                                        right: 8
                                    },
                                    width: "auto",
                                    allowHideAfter: 1000,
                                    autoHideAfter: 5000
                                });
                                */
                                grid.dataSource.read();
                                grid.clearSelection();
                                e.sender.hide($('#delete'));
                                //$("#ports-notification").getKendoNotification().show("Port has been " + (status == 1 ? "enabled" : "disabled"));
                            }
                        });
                    }).fail(function() {

                    });
                },
            },
            {
                type: 'button',
                text: 'Refresh',
                click: function (e) {
                    $('#keys-grid').data('kendoGrid').dataSource.read();
                },
            },
            {
                type: 'button',
                text: 'Clear Filter',
                click: function (e) {
                    $('#keys-grid').data('kendoGrid').dataSource.filter({});
                },
            },
            {
                type: 'button',
                text: 'New Key',
                icon: 'plus',
                click: function (e) {
                    let grid = $('#keys-grid').data('kendoGrid');
                    grid.addRow();
                },
            }
        ],
    });
}