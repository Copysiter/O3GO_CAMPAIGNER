window.initWizard = function() {
    const currentUser = window.isAuth.user;
    const permissions = currentUser.permissions || [];
    const canAssign = function (permissionSuffix) {
        return currentUser.is_superuser || permissions.includes(`campaign.assign_${permissionSuffix}`);
    };

    const user_field = window.isAuth.user.is_superuser ? [{
        field: "sep0",
        colSpan: 12,
        label: false,
        editor: "<div class='separator mx-n15'></div>"
    }, {
        field: "user_id",
        label: "User",
        colSpan: 6,
        editor: "DropDownList",
        editorOptions: {
            dataSource: {
                transport: {
                    read: {
                        url: `${api_base_url}/api/v1/options/user`,
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

    const assign_fields = [];

    if (canAssign('api_keys')) {
        assign_fields.push({
            field: 'api_keys',
            label: 'Api Keys',
            editor: 'MultiSelect',
            editorOptions: {
                dataSource: new kendo.data.DataSource({
                    transport: {
                        read: {
                            url: `${api_base_url}/api/v1/options/api_key`,
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
                    <button class="k-button k-button-solid-base k-button-solid k-button-md k-rounded-md" onclick="addNew('${value}', 'campaign-create-window')">Append</button>
                    </p>
                    `;
                },
            },
            colSpan: 12,
        });
    }

    if (canAssign('androids')) {
        assign_fields.push({
            field: 'androids',
            label: 'Android Devices',
            editor: 'MultiSelect',
            editorOptions: {
                dataSource: new kendo.data.DataSource({
                    transport: {
                        read: {
                            url: `${api_base_url}/api/v1/options/android`,
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
                autoClose: false
            },
            colSpan: 12,
        });
    }

    if (canAssign('tags')) {
        assign_fields.push({
            field: 'tags',
            label: 'Tags',
            editor: 'MultiSelect',
            editorOptions: {
                dataSource: new kendo.data.DataSource({
                    transport: {
                        read: {
                            url: `${api_base_url}/api/v1/options/tag`,
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
            },
            colSpan: 12,
        });
    }

    if (assign_fields.length) {
        assign_fields.unshift({
            field: "sep1",
            colSpan: 12,
            label: false,
            editor: "<div class='separator mx-n15'></div>"
        });
    }

    let empty_data = kendo.observable({
        user_id: null,
        data_source: 1,
        data_fields: {},
        rewrite: 0,
        provider: 'openrouter'
    })

    function clearData(data, excludeKeys) {
        const keys = Object.keys(data.toJSON());
        keys.forEach(function (key) {
            if (!excludeKeys.includes(key)) {
                data.unset(key);
            }
        });
    }

    window.resetWizard = function() {
        campaignCreateModel.source.fields.data([]);
        $("#wizard").data("kendoWizard").steps().forEach(function(step, index) {
            // if (index < 3) step.form.clear();
            step.form.clear();
            if (index == 0) step.form.editable.options.model.set("data_source", 1);
            $('#data-source').data('kendoDropDownList').trigger('change');
        });
        $("#wizard").data("kendoWizard").select(0);
        $('#campaign-create-schedule').scheduler('val', {});
        for (const [key, value] of Object.entries(campaignCreateModel.data)) {
            if (!value) {
                delete campaignCreateModel.data[key];
            }
        }
    }

    window.campaignCreateModel = kendo.observable({
        source: {
            data_type: [
                { text: "Excel, CSV", value: 1 },
                { text: "Text", value: 2 }
            ],
            fields: new kendo.data.DataSource({
                data: []
            })
        },
        data: empty_data
    });

    $("#wizard").kendoWizard({
        validateForms: {
            validateOnPrevious: false
        },
        steps: [{
            title: "Settings",
            //buttons: ["next"],
            form: {
                id: "wizar-form-1",
                validatable: {
                    validateOnBlur: false
                },
                layout: "grid",
                grid: { cols: 12, gutter: "15px 10px" },
                formData: campaignCreateModel.data,
                items: [{
                    field: "sep2",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: "name",
                    label: "Campaign Name",
                    colSpan: window.isAuth.user.is_superuser ? 12 : 6
                }].concat(user_field).concat([{
                    field: "webhook_url",
                    label: "Webhook URL",
                    colSpan: 6
                }]).concat(assign_fields).concat([{
                    field: "sep3",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    id: "data-source",
                    field: "data_source",
                    label: "Data  source",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.data_type,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true,
                        value: 1,
                        change: function(e) {
                            switch (e.sender.value()) {
                                case "1":
                                    $("#text-row-sep").closest(".k-form-field").hide();
                                    $("#text-col-sep").closest(".k-form-field").hide();
                                    $("#text").closest(".k-form-field").hide();
                                    $("#uploader").closest(".k-form-field").show();
                                break;
                                case "2":
                                    $("#text-row-sep").closest(".k-form-field").show();
                                    $("#text-col-sep").closest(".k-form-field").show();
                                    $("#text").closest(".k-form-field").show();
                                    $("#uploader").closest(".k-form-field").hide();
                                break;
                            }
                            $("#campaign-create-window").data("kendoWindow").center();
                        }
                    },
                    validation: { required: true }
                }, {
                    field: "data_text_row_skip",
                    label: "Skip rows",
                    colSpan: 6,
                    editor: "NumericTextBox",
                    editorOptions: {
                        format: "0",
                        min: 0
                    }
                }, {
                    field: "sep4",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    id: "campaigner-form-upload",
                    field: "file",
                    label: false,
                    colSpan: 12,
                    editor: "<input id='uploader' type='file' name='file' />",
                }, {
                    id: "text-row-sep",
                    field: "data_text_row_sep",
                    label: "Row separator",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: [
                            { text: "new_line ( \\n )", value: "\n" },
                            { text: "space ( )", value: " " },
                            { text: "dot ( . )", value: "." },
                            { text: "colon ( : )", value: "" },
                            { text: "semicolon ( ; )", value: ";" },
                            { text: "comma ( , )", value: "," },
                            { text: "pipe ( | )", value: "|" }
                        ],
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true,
                        hidden: true
                    }
                }, {   
                    id: "text-col-sep",
                    field: "data_text_col_sep",
                    label: "Column separator",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: [
                            { text: "space ( )", value: " " },
                            { text: "dot ( . )", value: "." },
                            { text: "colon ( : )", value: "" },
                            { text: "semicolon ( ; )", value: ";" },
                            { text: "comma ( , )", value: "," },
                            { text: "pipe ( | )", value: "|" }
                        ],
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true,
                        hidden: true
                    }
                }, {
                    id: "text",
                    field: "data_text",
                    label: "",
                    colSpan: 12,
                    //id: "description-dropDown",
                    editor: "TextArea",
                    editorOptions: {
                        overflow: "hidden",
                        rows: 10,
                        hidden: true
                    }, hidden: true
                }, {
                    field: "sep5",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: 'text',
                    colSpan: 6,
                    label: false,
                    editor: "<div class='mt-3'>Check DST Numbers:</div>",
                }, {
                    field: 'check_dst',
                    label: '',
                    editor: 'Switch',
                    editorOptions: {
                        width: 70,
                    },
                    colSpan: 6,
                }, {
                    field: "sep6",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }]),
            }
        }, {
            title: "Message",
            //buttons: ["previous", "next"],
            form: {
                orientation: "vertical",
                layout: "grid",
                grid: { cols: 12, gutter: "15px 10px" },
                formData: campaignCreateModel.data,
                items: [{
                    field: "sep7",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {    
                    id: "dst_addr",
                    field: "dst_addr",
                    label: "Phone Number",
                    colSpan: 4,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true, 
                    },
                    validation: { required: false }
                }, {
                    id: "field_1",
                    field: "field_1",
                    label: "Custom Field 1",
                    colSpan: 4,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true, 
                    }
                }, {
                    id: "field_2",
                    field: "field_2",
                    label: "Custom Field 2",
                    colSpan: 4,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true, 
                    }
                }, {
                    id: "field_3",
                    field: "field_3",
                    label: "Custom Field 3",
                    colSpan: 4,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true, 
                    }
                }, {
                    id: "field_4",
                    field: "field_4",
                    label: "Custom Field 4",
                    colSpan: 4,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true,
                    }
                }, {
                    id: "field_5",
                    field: "field_5",
                    label: "Custom Field 5",
                    colSpan: 4,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true,
                    }
                }, {
                    field: "sep8",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: "msg_template",
                    label: "Message Template",
                    colSpan: 12,
                    editor: "TextArea",
                    editorOptions: {
                        overflow: "auto",
                        rows: 8
                    },
                    validation: { required: false }
                }, {
                    field: "sep9",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: 'rewrite',
                    label: 'Rewrite',
                    colSpan: 4,
                    editor: 'DropDownList',
                    editorOptions: {
                        dataSource: new kendo.data.DataSource({
                            data: [
                                { text: 'NO', value: 0 },
                                { text: 'YES', value: 1 },
                            ],
                        }),
                        value: 0,
                        select: function (e) {},
                        dataTextField: 'text',
                        dataValueField: 'value',
                        valuePrimitive: true,
                        downArrow: true,
                        animation: false,
                        autoClose: true
                    }
                }, {
                    field: 'provider',
                    label: 'Provider',
                    colSpan: 4,
                    editor: 'DropDownList',
                    editorOptions: {
                        dataSource: new kendo.data.DataSource({
                            data: [
                                { text: 'OpenRouter', value: 'openrouter' },
                                { text: 'Local', value: 'ollama' },
                            ],
                        }),
                        value: 'openrouter',
                        select: function (e) {},
                        dataTextField: 'text',
                        dataValueField: 'value',
                        valuePrimitive: true,
                        downArrow: true,
                        animation: false,
                        autoClose: true
                    }
                }, {
                    field: 'model',
                    label: 'Model',
                    colSpan: 4,
                    editor: 'DropDownList',
                    editorOptions: {
                        dataSource: new kendo.data.DataSource({
                            data: [],
                        }),
                        value: '',
                        select: function (e) {},
                        dataTextField: 'text',
                        dataValueField: 'value',
                        valuePrimitive: true,
                        downArrow: true,
                        animation: false,
                        autoClose: true
                    }
                }, {
                    field: "system_prompt",
                    label: "System Prompt",
                    colSpan: 12,
                    editor: "TextArea",
                    editorOptions: {
                        overflow: "auto",
                        rows: 8
                    },
                    validation: { required: false }
                }, {
                    field: "sep10",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }],
            }
        }, {
            title: "Schedule",
            //buttons: ["previous", "done"],
            content: "<div id='campaign-create-schedule' class='schedule'></div>",
            form: {
                orientation: "vertical",
                layout: "grid",
                grid: { cols: 12, gutter: "15px 10px" },
                formData: campaignCreateModel.data,
                items: [{
                    field: "sep11",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: "order",
                    label: "Order",
                    editor: 'NumericTextBox',
                    editorOptions: {
                        format: "n0",
                        min: 1,
                        max: 100,
                        // value: 1
                    },
                    colSpan: 4
                }, {
                    field: "msg_attempts",
                    label: "Message Attempts",
                    editor: 'NumericTextBox',
                    editorOptions: {
                        format: "n0",
                        min: 1,
                        max: 100,
                        // value: 1
                    },
                    colSpan: 4
                }, {
                    field: "follow_limit",
                    label: "Follow Limit",
                    editor: 'NumericTextBox',
                    editorOptions: {
                        format: "n0",
                        min: 0,
                        // max: 100,
                        // value: 1
                    },
                    colSpan: 4
                }, {
                    field: "sep12",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: "msg_sending_timeout",
                    label: "Sending Timeout",
                    editor: 'NumericTextBox',
                    editorOptions: {
                        format: "n0",
                        min: 1
                    },
                    colSpan: 6
                }, {
                    field: "msg_status_timeout",
                    label: "Status Timeout",
                    editor: 'NumericTextBox',
                    editorOptions: {
                        format: "n0",
                        min: 1
                    },
                    colSpan: 6
                }, {
                    field: "sep13",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    id: "start_ts",
                    field: "start_ts",
                    label: "Start at",
                    colSpan: 6,
                    editor: "DateTimePicker",
                    editorOptions: {
                        format: "dd.MM.yyyy HH:mm",
                        timeFormat: "HH:mm"
                    }
                }, {
                    id: "stop_ts",
                    field: "stop_ts",
                    label: "Finish at",
                    colSpan: 6,
                    editor: "DateTimePicker",
                    editorOptions: {
                        format: "dd.MM.yyyy HH:mm",
                        timeFormat: "HH:mm"
                    }
                }, {
                    field: "schedule",
                    label: false,
                    colSpan: 12,
                    editor: "<div id='campaign-create-schedule' class='schedule'></div>",
                }, {
                    field: "sep14",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }],
            }
        }, {
            title: "Clicker",
            form: {
                orientation: "vertical",
                layout: "grid",
                grid: {cols: 12, gutter: "15px 10px"},
                formData: campaignCreateModel.data,
                items: [{
                    field: "sep1111",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: "clicker_url",
                    label: "Target URL",
                    colSpan: 12
                }, {
                    field: 'clicker_type',
                    label: 'Clicks Type',
                    colSpan: 6,
                    editor: 'DropDownList',
                    editorOptions: {
                        dataSource: new kendo.data.DataSource({
                            data: [
                                { text: 'Web', value: 'web' },
                                { text: 'Mobile', value: 'mobile' }
                            ],
                        }),
                        select: function (e) {},
                        dataTextField: 'text',
                        dataValueField: 'value',
                        valuePrimitive: true,
                        downArrow: true,
                        animation: false,
                        autoClose: true
                    }
                }, {
                    field: "clicker_goal",
                    label: "Clicks Goal",
                    colSpan: 6,
                    editor: "NumericTextBox",
                    editorOptions: {
                        format: "0",
                        min: 0
                    }
                }, {
                    field: 'clicker_utm_source',
                    label: 'UTM Source',
                    colSpan: 6,
                    editor: 'DropDownList',
                    editorOptions: {
                        dataSource: new kendo.data.DataSource({
                            data: [
                                { text: 'Telegram', value: 'telegram' },
                                { text: 'WhatsApp', value: 'whatsapp' },
                                { text: 'Instagram', value: 'instagram' },
                                { text: 'Facebook', value: 'facebook' },
                                { text: 'Messenger', value: 'messenger' },
                                { text: 'Viber', value: 'viber' },
                                { text: 'Kakao', value: 'kakao' },
                                { text: 'Botim', value: 'botim' }
                            ],
                        }),
                        select: function (e) {},
                        dataTextField: 'text',
                        dataValueField: 'value',
                        valuePrimitive: true,
                        downArrow: true,
                        animation: false,
                        autoClose: true
                    }
                }, {
                    field: "clicker_geo",
                    label: "Geo (ISO2 код)",
                    colSpan: 6
                }, {
                    id: "clicker_start_ts",
                    field: "clicker_start_ts",
                    label: "Start at",
                    colSpan: 6,
                    editor: "DateTimePicker",
                    editorOptions: {
                        format: "dd.MM.yyyy HH:mm",
                        timeFormat: "HH:mm"
                    }
                }, {
                    id: "clicker_stop_ts",
                    field: "clicker_stop_ts",
                    label: "Finish at",
                    colSpan: 6,
                    editor: "DateTimePicker",
                    editorOptions: {
                        format: "dd.MM.yyyy HH:mm",
                        timeFormat: "HH:mm"
                    }
                }, {
                    field: "sep52",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: 'text',
                    colSpan: 6,
                    label: false,
                    editor: "<div class='mt-3'>Batch Split:</div>",
                }, {
                    field: 'clicker_split',
                    label: '',
                    editor: 'Switch',
                    editorOptions: {
                        width: 70,
                    },
                    colSpan: 6,
                }, {
                    field: "sep521",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }]
            }
        }],

        activate(e) {
            $("#campaign-create-window").data("kendoWindow").center();

            switch (e.step.options.index) {
                case 0:
                    //console.log(campaignCreateModel.source.fields);
                break;
                case 1:
                    //console.log(campaignCreateModel.data);
                    if (campaignCreateModel.data.data_source == 2 && campaignCreateModel.data.data_text && campaignCreateModel.data.data_text.length) {
                        const rows = campaignCreateModel.data.data_text.split(campaignCreateModel.data.data_text_row_sep);
                        const row = rows[campaignCreateModel.data.data_text_row_skip ? campaignCreateModel.data.data_text_row_skip : 0].split(campaignCreateModel.data.data_text_col_sep);
                        campaignCreateModel.source.fields.data([]);
                        for (let i = 0; i < row.length; i ++) {
                            if (row[i].length) campaignCreateModel.source.fields.add({ value: i, text: row[i]});
                            if (i == 0) campaignCreateModel.data.set('dst_addr', i);
                            else if (i <= 5) campaignCreateModel.data.set(`field_${i}`, i);
                        }
                    }
                break;
                case 2:

                break;
            }
        },
        reset: function(e) {
            resetWizard();
        },
        done(e) {
            e.originalEvent.preventDefault();

            ['start_ts', 'stop_ts'].forEach((key) => {
                if (campaignCreateModel.data[key] != undefined) {
                    campaignCreateModel.data.set(key, kendo.toString(
                        campaignCreateModel.data[key], "yyyy-MM-dd HH:mm:ss"
                    ))
                }
            });
            ['dst_addr', 'field_1', 'field_2', 'field_3', 'field_4', 'field_5'].forEach((field) => {
                campaignCreateModel.data.data_fields.set(
                    field, campaignCreateModel.data[field]
                )
                delete campaignCreateModel.data[field]
            });
            const payload = campaignCreateModel.data.toJSON();
            if (!canAssign('api_keys')) delete payload.api_keys;
            if (!canAssign('androids')) delete payload.androids;
            if (!canAssign('tags')) delete payload.tags;

            $.ajax({
                url: `${api_base_url}/api/v1/campaigns/`,
                type: 'POST',
                dataType: 'json',
                data: JSON.stringify(payload),
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
                    $("#campaign-grid").data("kendoGrid").dataSource.insert(0, data);
                    $("#campaign-grid").data("kendoGrid").refresh();
                    $("#campaign-notification").getKendoNotification().show("Campaign has been created");
                    $("#campaign-create-window").data("kendoWindow").close();
                }
            });
        },
    });

    $("#text-row-sep").closest(".k-form-field").hide();
    $("#text-col-sep").closest(".k-form-field").hide();
    $("#text").closest(".k-form-field").hide();

    // kendo.bind($("#wizard"), campaignCreateModel.data);
    // wizard_data_blank.set("name", "sdvasdfas");

    $("#uploader").kendoUpload({
        async: {
            saveUrl: `${api_base_url}/api/v1/upload/`,
            // removeUrl: "Home/Remove",
            autoUpload: true,
            withCredentials: false,
        },
        validation: {
            allowedExtensions: [".txt", ".csv", ".xls", ".xlsx"],
            // maxFileSize: 10485760
        },
        multiple: false,
        beforeSend: function (xhr) {
            xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
        },
        success: function(e) {
            const fields = e.response.fields;
            campaignCreateModel.source.fields.data([]);
            if (fields.length) {
                for (i = 0; i < fields.length; i ++) {
                    campaignCreateModel.source.fields.add({ value: i, text: fields[i]});
                    if (i == 0) campaignCreateModel.data.set('dst_addr', i);
                    else if (i <= 5) campaignCreateModel.data.set(`field_${i}`, i);
                }
            }
            campaignCreateModel.data.set("data_file_name", e.response.filename);
        }
    });
    
    $.fn.scheduler.locales['en'] = {
        AM: 'AM',
        PM: 'PM',
        TIME_TITLE: '',
        WEEK_TITLE: '',
        WEEK_DAYS: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        DRAG_TIP: 'Drag to select hours',
        RESET: 'Reset Selected'
    };

    $('#campaign-create-schedule').scheduler({
        // https://www.jqueryscript.net/time-clock/appointment-week-view-scheduler.html
        locale: 'en',
        onSelect: function (data) {
            campaignCreateModel.data.set("schedule", data);
        }
    });

}
