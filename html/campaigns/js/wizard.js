window.initWizard = function() {
    /*
    window.wizard_data_blank = {
        name: null,
        customer_id: null,
        peer_id: null,
        data_source: 1,
        data_skip_rows: null,
        data_file_name: null,
        data_text: null,
        data_text_row_skip: null,
        data_text_row_sep: null,
        data_text_col_sep: null,
        dst_addr: null,
        field_1: null,
        field_2: null,
        field_3: null,
        msg_template: null,
        schedule: null,
    };
    */
    window.resetWizard = function() {
        campaignCreateModel.set("data", { fields: {} });
        campaignCreateModel.source.fields.data([]);
        $("#wizard").data("kendoWizard").steps().forEach(function(step, index) {
            if (index < 2) step.form.clear();
            if (index == 0) step.form.editable.options.model.set("data_source", 1);
        });
        $("#wizard").data("kendoWizard").select(0);
        $('#campaign-create-schedule').scheduler('val', {});
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
        data: {
            user_id: isAuth.user.id,
            fields: {}
        }
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
                //formData: campaignCreateModel.data,
                formData: {
                    data_source: 1
                },
                items: [{
                    field: "sep1",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: "name",
                    label: "Campaign Name:",
                    colSpan: 12
                }, {
                    field: "sep2",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }/*, {
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
                        dataBound: function(e) {
                            console.log(isAuth.user.id);
                            campaignCreateModel.data.set("user_id", isAuth.user.id);
                            this.select(function(item) {
                                return item.value === isAuth.user.id;
                            });
                            //this.trigger("select");
                        },
                        dataTextField: "text",
                        dataValueField: "value",
                        optionLabel: "Select user...",
                        valuePrimitive: true
                    },
                    // validation: { required: true }
                    hidden: true
                }, {
                    field: "src_addr",
                    label: "SRC Addr:",
                    colSpan: 6,
                    validation: { required: true }
                }*/, {
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
                            <button class="k-button k-button-solid-base k-button-solid k-button-md k-rounded-md" onclick="addNew('${value}', 'campaign-create-window')">Append</button>
                            </p>
                            `;
                        },
                    },
                    colSpan: 12,
                }, {
                    field: "sep3",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    id: "data-source",
                    field: "data_source",
                    label: "Data  source:",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.data_type,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true,
                        value: 1,
                        change: function(e) {
                            //console.log(e.sender._form);
                            //campaignCreateModel.data.msg_template = "asdbvadvd asdasdfads sdfasdfas asdfasdf asdfasdfas asfasdfasfasfa asdfasfa fwffffqf";
                            //campaignCreateModel.data.set("msg_template", "asdbvadvd asdasdfads sdfasdfas asdfasdf asdfasdfas asfasdfasfasfa asdfasfa fwffffqf");
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
                    label: "Skip rows:",
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
                    label: "Row separator:",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: [
                            { text: "new_line ( \\n )", value: "\n" },
                            { text: "space ( )", value: " " },
                            { text: "dot ( . )", value: "." },
                            { text: "colon ( : )", value: ":" },
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
                    label: "Column separator:",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: [
                            { text: "space ( )", value: " " },
                            { text: "dot ( . )", value: "." },
                            { text: "colon ( : )", value: ":" },
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
                        rows: 4,
                        hidden: true
                    }, hidden: true
                }, {
                    field: "sep5",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }],
                change(e) {
                    if (!["sep1", "sep2", "sep3", "sep4", "file"].includes(e.field)) {
                        campaignCreateModel.data.set(e.field, e.value);
                    }
                }
            }
        }, {
            title: "Message",
            //buttons: ["previous", "next"],
            form: {
                orientation: "vertical",
                layout: "grid",
                grid: { cols: 12, gutter: "15px 10px" },
                //formData: campaignCreateModel.data,
                items: [{
                    field: "sep5",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {    
                    id: "dst_addr",
                    field: "dst_addr",
                    label: "Phone Number:",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true, 
                    },
                    validation: { required: true }
                }, {
                    id: "field_1",
                    field: "field_1",
                    label: "Custom Field 1:",
                    colSpan: 6,
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
                    label: "Custom Field 2:",
                    colSpan: 6,
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
                    label: "Custom Field 3:",
                    colSpan: 6,
                    editor: "DropDownList",
                    editorOptions: {
                        dataSource: campaignCreateModel.source.fields,
                        dataTextField: "text",
                        dataValueField: "value",
                        valuePrimitive: true, 
                    }
                }, {
                    field: "sep6",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }, {
                    field: "msg_template",
                    label: "",
                    colSpan: 12,
                    editor: "TextArea",
                    editorOptions: {
                        overflow: "hidden",
                        rows: 4
                    },
                    validation: { required: true }
                }, {
                    field: "sep7",
                    colSpan: 12,
                    label: false,
                    editor: "<div class='separator mx-n15'></div>"
                }],
                change(e) {
                    if (e.field == "msg_template") campaignCreateModel.data.set(e.field, e.value);
                    else campaignCreateModel.data.fields.set(e.field, e.value);
                }
            }
        }, {
            title: "Schedule",
            //buttons: ["previous", "done"],
            content: "<div id='campaign-create-schedule' class='schedule'></div>",
            form: {
                orientation: "vertical",
                layout: "grid",
                grid: { cols: 12, gutter: "15px 10px" },
                //formData: campaignCreateModel.data,
                items: [{
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
                    field: "schedule",
                    label: false,
                    colSpan: 12,
                    editor: "<div id='campaign-create-schedule' class='schedule'></div>",
                }],
                change(e) {
                    if ((e.field == "start_ts" || e.field == "stop_ts") && e.value != undefined) {
                        campaignCreateModel.data.set(e.field, kendo.toString(e.value, "yyyy-MM-dd HH:mm:ss"));
                    }
                }
            }
        }],
        select(e) {
            // var validatable = $("#wizard-0 form").kendoValidator().data("kendoValidator");
            /*
            var validatable = $("#wizard-0 form").kendoValidator({
                validate: function(e) {
                    alert("Validating");
                }
            }).getKendoValidator();
            validatable.validate();
            */

            /*
            console.log(e.step.options.index);
            console.log(campaignCreateModel.data.dst_addr);
            if (e.step.options.index == 1 && (!campaignCreateModel.data.name || !campaignCreateModel.data.customer_id || !campaignCreateModel.data.peer_id)) e.preventDefault();
            if (e.step.options.index == 2 && (campaignCreateModel.data.dst_addr == null|| !campaignCreateModel.data.msg_template)) e.preventDefault();
            */

            //console.log($("#wizard-0 form").data("kendoForm").validate());
            //$("#wizard-0 form").kendoValidator().data("kendoValidator").validate();
            //if (!campaignCreateModel.data.name) e.preventDefault();
            //console.log($("#wizard-0 form").data("kendoForm"));
            //console.log(e.sender.steps())
        },
        /*
        select(e) {
            switch (e.step.options.index) {
                case 0:
                    //console.log(campaignCreateModel.source.fields);
                break;
                case 1:
                    if (campaignCreateModel.data.data_source == 2 && campaignCreateModel.data.data_text && campaignCreateModel.data.data_text.length) {
                        const rows = campaignCreateModel.data.data_text.split(campaignCreateModel.data.data_text_row_sep);
                        const row = rows[campaignCreateModel.data.data_text_row_skip ? campaignCreateModel.data.data_text_row_skip : 0].split(campaignCreateModel.data.data_text_col_sep);
                        campaignCreateModel.source.fields.data([]);
                        for (i = 0; i < row.length; i ++) {
                            if (row[i].length) campaignCreateModel.source.fields.add({ value: i, text: row[i]});
                        }
                    }
                break;
                case 2:

                break;
            }
        },
        */
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
                        for (i = 0; i < row.length; i ++) {
                            //console.log(i);
                            if (row[i].length) campaignCreateModel.source.fields.add({ value: i, text: row[i]});
                            //console.log(row[i]);
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
            /*
            e.preventDefault();
            let data = campaignCreateModel.data.toJSON();
            console.log(data);
            console.log(JSON.stringify(data));
            return;
            */
           //console.log(campaignCreateModel.data)
           //console.log(campaignCreateModel.data.toJSON())
            $.ajax({
                url: `http://${api_base_url}/api/v1/campaigns/`,
                type: 'POST',
                dataType: 'json',
                data: JSON.stringify(campaignCreateModel.data.toJSON()),
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
    })/*.data("kendoWizard")*/;

    // Apply the bindings.
    // kendo.bind($("#wizard-0 form"), campaignCreateModel);
    // kendo.bind($("#wizard-1 form"), campaignCreateModel);

    // kendo.bind($("#wizard"), campaignCreateModel);

    /*
    kendo.bind($("#wizard-0 form"), campaignCreateModel);
    kendo.bind($("#wizard-1 form"), campaignCreateModel);
    $("#wizard-0 form").kendoValidator({
        validateOnBlur: false
    });
    kendoValidator = $("#wizard-0 form").getKendoValidator();
    campaignCreateModel.bind("change", function(e) {
        kendoValidator.validate();
    });
    */

    $("#text-row-sep").closest(".k-form-field").hide();
    $("#text-col-sep").closest(".k-form-field").hide();
    $("#text").closest(".k-form-field").hide();

    // kendo.bind($("#wizard"), campaignCreateModel.data);
    // wizard_data_blank.set("name", "sdvasdfas");

    $("#uploader").kendoUpload({
        async: {
            saveUrl: `http://${api_base_url}/api/v1/upload/`,
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