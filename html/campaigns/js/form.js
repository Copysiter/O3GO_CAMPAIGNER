window.initForm = function() {
    const user_field = window.isAuth.user.is_superuser ? [{
        field: "sep1",
        colSpan: 12,
        label: false,
        editor: "<div class='separator mx-n15'></div>"
    }, {
        field: "user_id",
        label: "User:",
        colSpan: 6,
        editor: "DropDownList",
        editorOptions: {
            dataSource: {
                transport: {
                    read: {
                        url: `http://${api_base_url}/api/v1/options/user`,
                        type: "GET",
                        beforeSend: function (request) {
                            request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                        },
                    }
                }
            },
            dataBound: function (e) {
                // console.log(isAuth.user.id);
                // campaignCreateModel.data.set("user_id", isAuth.user.id);
                // this.select(function(item) {
                //     return item.value === isAuth.user.id;
                // });
                //this.trigger("select");
            },
            dataTextField: "text",
            dataValueField: "value",
            optionLabel: "Select user...",
            valuePrimitive: true
        },
    }] : [];

    $("#campaign-edit-form").kendoForm({
        orientation: "vertical",
        layout: "grid",
        grid: { cols: 12, gutter: "15px 10px" },
        items: [{
            field: "name",
            label: "Campaign Name:",
            colSpan: window.isAuth.user.is_superuser ? 12 : 6
        }].concat(user_field).concat([{
            field: "webhook_url",
            label: "Webhook URL:",
            colSpan: 6
        }, {
            field: "sep2",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }, {
            field: "order",
            label: "Order:",
            editor: 'NumericTextBox',
            editorOptions: {
                format: "n0",
                min: 1,
                max: 100,
                // value: 1
            },
            colSpan: 6
        }, {
            field: "msg_attempts",
            label: "Message Attempts:",
            editor: 'NumericTextBox',
            editorOptions: {
                format: "n0",
                min: 1,
                max: 100,
                // value: 1
            },
            colSpan: 6
        }, {
            field: "sep3",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }, {
            field: "msg_template",
            label: "",
            colSpan: 12,
            editor: "TextArea",
            editorOptions: {
                overflow: "auto",
                rows: 10
            },
            validation: { required: false }
        }, {
            field: "sep4",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }, {
            field: 'api_keys',
            label: 'Api Keys',
            editor: 'MultiSelect',
            editorOptions: {
                dataSource: new kendo.data.DataSource({
                    transport: {
                        read: {
                            url: `http://${api_base_url}/api/v1/options/api_key`,
                            type: 'GET',
                            beforeSend: function (request) {
                                request.setRequestHeader(
                                    'Authorization',
                                    `${token_type} ${access_token}`
                                );
                            },
                        },
                    },
                }),
                dataTextField: 'text',
                dataValueField: 'value',
                valuePrimitive: true,
                downArrow: true,
                animation: false,
                autoClose: false,
                noDataTemplate: function (e) {
                    let value = e.instance.input.val();
                    return `
                    <div class='no-data'>
                    <p>Api Key not found.<br>Do you want to add new Api Key ${value} ?</p> 
                    <button class="k-button k-button-solid-base k-button-solid k-button-md k-rounded-md" onclick="addNew('${value}', 'campaign-edit-window')">Append</button>
                    </p>
                    `;
                },
            },
            colSpan: 12,
        }, {
            field: "sep5",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }, {
            field: 'tags',
            label: 'Tags',
            editor: 'MultiSelect',
            editorOptions: {
                dataSource: new kendo.data.DataSource({
                    transport: {
                        read: {
                            url: `http://${api_base_url}/api/v1/options/tag`,
                            type: 'GET',
                            beforeSend: function (request) {
                                request.setRequestHeader(
                                    'Authorization',
                                    `${token_type} ${access_token}`
                                );
                            },
                        },
                    },
                }),
                dataTextField: 'text',
                dataValueField: 'value',
                valuePrimitive: true,
                downArrow: true,
                animation: false,
                autoClose: false,
                // noDataTemplate: function (e) {
                //     let value = e.instance.input.val();
                //     return `
                //     <div class='no-data'>
                //     <p>Api Key not found.<br>Do you want to add new Api Key ${value} ?</p>
                //     <button class="k-button k-button-solid-base k-button-solid k-button-md k-rounded-md" onclick="addNew('${value}', 'campaign-create-window')">Append</button>
                //     </p>
                //     `;
                // },
                // tagTemplate: '<span class="k-chip k-chip-md k-rounded-md k-chip-solid k-chip-solid-base" unselectable="on" style="color::color_txt;background::color_bg;">' +
                //     '<span unselectable="on" class="k-chip-content"><span class="k-chip-label">:name</span></span>' +
                //     '<span class="k-chip-action k-chip-remove-action" unselectable="on" aria-hidden="true" aria-label="delete" title="delete">' +
                //     '<span class="k-icon k-i-x-circle"></span>' +
                //     '</span>' +
                //     '</span>'
            },
            colSpan: 12,
        }, {
            field: "sep6",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }, {
            field: "msg_sending_timeout",
            label: "Sending Timeout:",
            editor: 'NumericTextBox',
            editorOptions: {
                format: "n0",
                min: 1
            },
            colSpan: 6
        }, {
            field: "msg_status_timeout",
            label: "Status Timeout:",
            editor: 'NumericTextBox',
            editorOptions: {
                format: "n0",
                min: 1
            },
            colSpan: 6
        }, {
            field: "sep7",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }, {
            id: "start_ts",
            field: "start_ts",
            label: "Start at:",
            colSpan: 6,
            editor: "DateTimePicker",
            editorOptions: {
                format: "dd.MM.yyyy HH:mm",
                timeFormat: "HH:mm"
            }
        }, {
            id: "stop_ts",
            field: "stop_ts",
            label: "Finish at:",
            colSpan: 6,
            editor: "DateTimePicker",
            editorOptions: {
                format: "dd.MM.yyyy HH:mm",
                timeFormat: "HH:mm"
            }
        }, {
            field: "sep8",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }, {
            field: "schedule",
            colSpan: 12,
            label: false,
            editor: "<div id='campaign-edit-schedule' class='schedule'></div>"
        }, {
            field: "sep9",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        }]),
        // labelPosition: "before",
        buttonsTemplate: "<div class='w-100 mt-15 mb-n15'><button id='form-save' type='submit' class='k-button k-button-lg k-rounded-md k-button-solid k-button-solid-base me-4'>Submit</button><button id='window-cancel' class='k-button k-button-lg k-rounded-md k-button-solid k-button-solid-base k-form-clear ms-4'>Cancel</button></div>",
        change: function(e) {
        },
        validateField: function(e) {
        },
        submit: function(e) {
            e.preventDefault();
            let data = e.model;
            let id = data.ID;
            if (data.create_ts !== undefined) {
                data.create_ts = kendo.toString(data.create_ts, "yyyy-MM-dd HH:mm:ss")
            }
            if (data.start_ts !== undefined) {
                data.start_ts = kendo.toString(data.start_ts, "yyyy-MM-dd HH:mm:ss")
            }
            if (data.stop_ts !== undefined) {
                data.stop_ts = kendo.toString(data.stop_ts, "yyyy-MM-dd HH:mm:ss")
            }
            $.ajax({
                url: `http://${api_base_url}/api/v1/campaigns/${id}`,
                type: "PUT",
                dataType: 'json',
                data: JSON.stringify(data),
                contentType: 'application/json;charset=UTF-8',
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
                    campaignUpdate(data);
                    $("#campaign-notification").getKendoNotification().show("All changes are saved");
                }
            });
            $("#campaign-edit-window").data("kendoWindow").close();
        },
        clear: function(e) {
            $("#campaign-edit-window").data("kendoWindow").close();
        }
    }).data('kendoForm');

}

function addNew(value, id) {
    let token = window.isAuth;
    let { access_token, token_type } = token;
    $.ajax({
        type: 'POST',
        url: `http://${api_base_url}/api/v1/api_keys/`,
        headers: {
            Authorization: `${token_type} ${access_token}`,
            accept: 'application/json'
        },
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({value: value})
    }).done(function (result) {
        let widget = $(`#${id} #api_keys`).data('kendoMultiSelect');
        let dataSource = widget.dataSource;
        dataSource.add({
            text: value,
            value: value,
        });
        let allSelected = widget
            .dataItems()
            .concat(dataSource.data()[dataSource.data().length - 1]);
        let multiData = [];
        for (let i = 0; i < allSelected.length; i++) {
            multiData.push({
                text: allSelected[i].text,
                value: allSelected[i].value,
            });
        }
        widget.value(multiData);
        widget.trigger('change');
        widget.close();
        document.querySelector(`#${id} .k-selection-multiple`).lastChild.value = '';
    })
    .fail(function (result) {

    });
}
