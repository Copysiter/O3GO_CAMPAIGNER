window.initCampaignGrid = function() {

    var campaignTimer;
    let campaignShowLoader = true;
    let campaignResizeColumn = false;

    window.selectedCampaignId = null;
    window.selectedCampaignItem = null;
    window.selectedCampaignItems = null;

    $('#campaign-grid').kendoGrid({
        dataSource: {
            transport: {
                read: {
                    url: `http://${api_base_url}/api/v1/campaigns/`,
                    //dataType: 'jsonp',
                    //jsonp: "jsoncallback",
                    beforeSend: function (request) {
                        request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                    },
                },
                parameterMap: function(data) {
                    if (data.hasOwnProperty('take')) {
                        data.limit = data.take;
                        delete data.take;
                    }
                    if (data.hasOwnProperty('page')) {
                        delete data.page;
                    }
                    if (data.hasOwnProperty('pageSize')) {
                        delete data.pageSize;
                    }
                    if (data.hasOwnProperty('filter') && data.filter) {
                        data.filter = data.filter.filters;
                    }
                    return data;
                }
                // dataType: "jsonp"
            },
            schema: {
                data: "data",
                total: "total",
                model: {
                    id: "id",
                    fields: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        status: { type: 'number' },
                        user_id: { type: 'number' },
                        msg_template: { type: 'string' },
                        create_ts: { type: 'date' },
                        start_ts: { type: 'date' },
                        stop_ts: { type: 'date' },
                    },
                },
            },
            // data: [
            //     {id: "", name: 'first', status: 'stopped', route: 'Default', message: 'abcdef', created: '2022-05-25 11:38:36', started: '2022-05-25 11:38:36', stopped: '2022-06-25 11:48:36', actions: ''},
            //     {id: "", name: 'second', status: 'complete', route: 'Default', message: 'abcdef', created: '2022-05-25 11:38:36', started: '2022-05-25 11:38:36', stopped: '2022-06-25 11:48:36', actions: ''},
            //     {id: "", name: 'third', status: 'low balance', route: 'Default', message: 'abcdef', created: '2022-05-25 11:38:36', started: '2022-05-25 11:38:36', stopped: '2022-06-25 11:48:36', actions: ''}
            // ],
            pageSize: 20,
            serverPaging: true, // true
            serverFiltering: true, // true
            serverSorting: true, // true
            requestStart: function(e) {
                setTimeout(function(e) {
                    if (campaignShowLoader) $(".k-loading-mask").show();
                });
            },
            requestEnd: function(e) {
                /*
                e.response.data.forEach(element => {
                    for(prop in element) {
                        if((prop === 'create_ts' || prop === 'start_ts' || 
                        prop === 'stop_ts') && element[prop] !== null) {
                            let time = timeConverter(element[prop])
                            element[prop] = time
                        }
                    }
                });
                console.log(e.response.data);
                */
            },
        },
        //width: "auto",
        height: '100%',
        reorderable: true,
        resizable: true,
        selectable: "multiple, row",
        persistSelection: true,
        sortable: true,
        /*
        edit: function (e) {
            form.data('kendoForm').setOptions({
                formData: e.model,
            });
            popup.setOptions({
                title: e.model.id ? 'Edit Campaign' : 'New Campaign',
            });
            popup.center();
        },
        editable: {
            mode: 'popup',
            template: kendo.template($('#campaigns-popup-editor').html()),
            window: {
                width: 488,
                maxHeight: '90%',
                animation: false,
                appendTo: '#app-root',
                visible: false,
                open: function (e) {
                    form = showEditForm();
                    popup = e.sender;
                    popup.center();
                },
            },
        },
        */
        filterable: {
            extra: false,
            // mode: 'row'
        },
        pageable: {
            refresh: true,
            pageSizes: [20, 50, 100, 250, 500, 1000],
        },
        dataBinding: function(e) {
            clearTimeout(campaignTimer);
        },
        dataBound: function(e) {
            campaignShowLoader = true;
            campaignTimer = setTimeout(function () {
                campaignShowLoader = false;
                e.sender.dataSource.read();
            }, 60000);
        },
        change: function (e) {
            window.selectedCampaignItems = []
            let rows = e.sender.select();
            window.selectedCampaignItem = e.sender.dataItem(rows[0]);
            for (let i = 0; i < rows.length; i++) {
                let dataItem = e.sender.dataItem($(rows[i]));
                if (window.selectedCampaignItems.indexOf(dataItem) == -1) {
                    window.selectedCampaignItems.push(dataItem);
                }
            }
        },
        columns: [
            {
                field: 'id',
                title: '#',
                width: '60px',
                filterable: false
            },
            {
                field: 'name',
                width: '120px',
                title: 'Name',
                template: '<b>#: name ? name : "" #</b>',
                filterable: {
                    cell: {
                        showOperators: false,
                    },
                },
            },
            {
                field: 'status',
                width: '100px',
                title: 'Status',
                template: function(item) {
                    if (item.status == 0) {
                        return "<span class='info info-sm info-light'>Created</span>"
                    } else if(item.status == 1) {
                        return "<span class='info info-sm info-green'>Running</span>"
                    } else if(item.status == 2) {
                        return "<span class='info info-sm info-red'>Stopped</span>"
                    } else if(item.status == 3) {
                        return "<span class='info info-sm info-blue'>Complete</span>"
                    }
                },
                filterable: {
                    operators: {
                        string: {
                            eq: "is",
                        }
                    },
                    ui : function(element) {
                        element.kendoDropDownList({
                            animation: false,
                            dataSource: [{value: 0, text: "Created"}, {value: 1, text: "Running"}, {value: 2, text: "Stopped"}, {value: 3, text: "Complete"}],
                            dataTextField: "text",
                            dataValueField: "value",
                            valuePrimitive: true,
                            optionLabel: "-- Select Status --"
                        });
                    }
                }
            },
            {
                field: 'user_id',
                width: '100px',
                title: 'User',
                template: '#: user.name #',
                filterable: {
                    operators: {
                        string: {
                            eq: "Equal to",
                            neq: "Not equal to"
                        }
                    },
                    ui : function(element) {
                        element.kendoDropDownList({
                            animation: false,
                            dataSource: new kendo.data.DataSource({
                                transport: {
                                    read: {
                                        url: `http://${api_base_url}/api/v1/options/user`,
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
                            dataTextField: "text",
                            dataValueField: "value",
                            valuePrimitive: true,
                            optionLabel: "-- Select Customer --"
                        });
                    }
                }
            },
            {
                field: 'tags',
                title: 'TAGS',
                maxWidth: 60,
                template:
                    "<div class='d-flex'># for (var i = 0; i < tags.length; i++) { #<span class='badge badge-sm k-badge k-badge-solid k-badge-md k-badge-rounded k-badge-inline' style='color:#:tags[i].color_txt#;background:#:tags[i].color_bg#;'>#:tags[i].name#</span># } #</div>",
                sortable: false,
                filterable: {
                    multi: true,
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
                    itemTemplate: function(e) {
                        console.log(e);
                        if (e.field == "all") {
                            //handle the check-all checkbox template
                            return "";
                        } else {
                            //handle the other checkboxes
                            return "<div class=''><label class='d-flex align-items-center py-8 ps-3 border-bottom cursor-pointer'><input type='checkbox' name='" + e.field + "' value='#=value#' class='k-checkbox k-checkbox-md k-rounded-md'/><span class='ms-8'>#=text#</span></label></div>"
                        }
                    }
                }
            },
            {
                field: "api_keys",
                title: "Api Keys",
                filterable: false,
                maxWidth: 360,
                template: function (obj) {
                    let html = '';
                    if (obj.api_keys) {
                        obj.api_keys.forEach(function (key) {
                            html += `<span class="k-chip k-chip-sm k-rounded-md k-chip-solid k-chip-solid-base m-3 px-5 py-3 fs-14">${key}</span>`;
                        });
                    }
                    return `<div class="inline-blocks d-flex flex-wrap m-n3">${html}</div>`;
                }
            },
            {
                field: 'msg_template',
                // width: 80,
                title: 'Message',
                encoded: false,
                filterable: {
                    cell: {
                        showOperators: false,
                    },
                },
                template: function(item) {
                    if (item.msg_template != undefined) {
                        return `<div class="long_text">
                                ${item.msg_template.replaceAll("\n", "<br>")}
                                </div>`;
                    } else {
                        return '';
                    }
                },
                minWidth: 480,
                maxWidth: 640
            },
            {
                field: 'msg_total',
                title: 'Total',
                filterable: false
            },
            {
                field: 'msg_sent',
                title: 'Sent',
                filterable: false
            },
            {
                field: 'msg_delivered',
                title: 'Delivered',
                filterable: false
            },
            {
                field: 'msg_undelivered',
                title: 'Undelivered',
                filterable: false
            },
            {
                field: 'msg_failed',
                title: 'Failed',
                filterable: false
            },
            {
                field: 'create_ts',
                title: 'Created',
                width: '150px',
                format: '{0: yyyy-MM-dd HH:mm:ss}',
                filterable: false
                // filterable: {
                //     ui: "datepicker",
                // }
            },
            {
                field: 'start_ts',
                title: 'Started',
                width: '150px',
                format: '{0: yyyy-MM-dd HH:mm:ss}',
                filterable: false
                // filterable: {
                //     ui: "datepicker",
                // }
            },
            {
                field: 'stop_ts',
                title: 'Stopped',
                width: '150px',
                format: '{0: yyyy-MM-dd HH:mm:ss}',
                /*
                template: function(obj) {
                    if (obj.stop_ts) {
                        return new Date(Date.parse(obj.stop_ts));
                    } else {
                        return ""
                    }
                },
                */
                filterable: false
                // filterable: {
                //     ui: "datepicker",
                // }
            },
            {}
        ]
    });

    jQuery.fn.selectText = function(){
        var doc = document;
        var element = this[0];
        $("input, textarea, select").blur();
        if (doc.body.createTextRange) {
            var range = document.body.createTextRange();
            range.moveToElementText(element);
            range.select();
        } else if (window.getSelection) {
            var selection = window.getSelection();        
            var range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };
    
    $("#campaign-grid").on("dblclick", "td[role='gridcell']", function(e) {
        console.log('1');
        var text = $(this).find(".text");
        if (text.length) text.selectText();
        else $(this).selectText();
    });


    $(document).keydown(function(e) {
        if (e.key === "Escape") {
            selectedDataItems = [];
            selectedItemIds = [];
            selectedItemImsi = [];
            $("#campaign-grid").data("kendoGrid").clearSelection();
        }
    });

    window.optimize_grid(['#campaign-grid']);

}