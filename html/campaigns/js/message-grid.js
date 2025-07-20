window.initMessageGrid = function(id) {

    let messageShowLoader = true;
    let messageResizeColumn = false;

    $('#message-grid').kendoGrid({
        dataSource: {
            transport: {
                read: {
                    //url: `${campaigner_api_addr}/api/v1/campaigns/${id}`,
                    url: `http://${api_base_url}/api/v1/campaigns/${id}/campaign_dst`,
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
                        dst_addr: { type: 'string' },
                        text: { type: 'string' },
                        field_1: { type: 'string' },
                        field_2: { type: 'string' },
                        field_3: { type: 'string' },
                        status: { type: 'number' },
                        // empty: {}
                    },
                },
            },
            // data: [
            //     {number: '1', phone: '89083645021', message: 'abcdef', status: 'New', sms_count: '10'},
            //     {number: '2', phone: '89108301114', message: 'yythtg', status: 'New', sms_count: '10'},
            //     {number: '3', phone: '89650987652', message: 'ffffff', status: 'New', sms_count: '10'},
            // ],
            pageSize: 100,
            serverPaging: true, // true
            serverFiltering: true, // true
            serverSorting: true, // true
            autoBind: false,
            autoSync: true,
            requestStart: function(e) {
                //if (window.selectedCampaignItem) e.sender.transport.options.read.url = `${campaigner_api_addr}/api/v1/campaigns/${window.selectedCampaignItem.id}/message`;
                setTimeout(function(e) {
                    if (messageShowLoader) $(".k-loading-mask").show();
                });
            }
            // requestEnd: function(e) {
            //     e.response.data.forEach(element => {
            //         for(prop in element) {
            //             if((prop === 'create_ts' || prop === 'start_ts' || 
            //             prop === 'stop_ts') && element[prop] !== null) {
            //                 let time = timeConverter(element[prop])
            //                 element[prop] = time
            //             }
            //         }
            //     });
        },
        //width: "auto",
        height: '100%',
        reorderable: true,
        resizable: true,
        selectable: "row",
        persistSelection: true,
        sortable: true,
        filterable: {
            extra: false,
            // mode: 'row'
        },
        pageable: {
            refresh: true,
            pageSizes: [100, 250, 500, 1000],
        },
        dataBinding: function(e) {
            if (window.messageTimer) clearTimeout(messageTimer);
        },
        dataBound: function(e) {
            messageShowLoader = true;
            window.messageTimer = setTimeout(function () {
                messageShowLoader = false;
                e.sender.dataSource.read();
            }, 60000);
        },
        columns: [
            {
                field: 'dst_addr',
                width: '100px',
                title: 'DST Number',
                template: '<b>#: dst_addr #</b>',
                filterable: {
                    cell: {
                        showOperators: false,
                    },
                },
            },
            {
                field: 'src_addr',
                width: '100px',
                title: 'SRC Number',
                // template: '<b>#: dst_addr #</b>',
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
                    if(item.status == -1) {
                        return "<span class='badge badge-sm k-badge k-badge-solid k-badge-md k-badge-rounded k-badge-dark'>WAITING</span>"
                    }
                    if(item.status == 0) {
                        return "<span class='badge badge-sm k-badge k-badge-solid k-badge-md k-badge-rounded k-badge-light'>CREATED</span>"
                    }
                    else if(item.status == 1) {
                        return "<span class='badge badge-sm k-badge k-badge-solid k-badge-md k-badge-rounded k-badge-primary'>SUBMITTED</span>"
                    }
                    else if(item.status == 2) {
                        return "<span class='badge badge-sm k-badge k-badge-solid k-badge-md k-badge-rounded k-badge-success'>DELIVERED</span>"
                    }
                    else if(item.status == 3) {
                         return "<span class='badge badge-sm k-badge k-badge-solid k-badge-md k-badge-rounded k-badge-warning'>UNDELIVERED</span>"
                    }
                    else if(item.status == 4) {
                         return "<span class='badge badge-sm k-badge k-badge-solid k-badge-md k-badge-rounded k-badge-error'>FAILED</span>"
                    }
                },
                sortable: false,
                filterable: {
                    operators: {
                        string: {
                            eq: "is",
                        }
                    },
                    ui : function(element) {
                        element.kendoDropDownList({
                            animation: false,
                            dataSource: [
                                {value: -1, text: "WAITING"},
                                {value: 0, text: "CREATED"},
                                {value: 1, text: "SUBMITTED"},
                                {value: 2, text: "DELIVERED"},
                                {value: 3, text: "UNDELIVERED"},
                                {value: 4, text: "FAILED"}
                            ],
                            dataTextField: "text",
                            dataValueField: "value",
                            valuePrimitive: true,
                            optionLabel: "-- Select Status --"
                        });
                    }
                }
            },
            {
                field: 'attempts',
                title: 'Attempts',
                filterable: false,
                sortable: false
            },
            {
                field: 'text',
                title: 'Message',
                // template: '<div class="long_text">#: text #</div>',
                template: function(item) {
                    if (!item.text) return '';
                    return `<div class="long_text">
                            ${item.text ? item.text : item.text.replaceAll("\n", "<br>")}
                            </div>`
                },
                sortable: false,
                minWidth: 480,
                maxWidth: 640
            }, {
                field: 'field_1',
                width: '100px',
                title: 'Field 1',
                filterable: {
                    cell: {
                        showOperators: false,
                    },
                },
                template: function(item) {
                    if (!item.field_1) return '';
                    return `<div class="short_text">
                            ${item.field_1.replaceAll("\n", "<br>")}
                            </div>`
                },
            },
            {
                field: 'field_2',
                width: '100px',
                title: 'Field 2',
                filterable: {
                    cell: {
                        showOperators: false,
                    },
                },
                template: function(item) {
                    if (!item.field_2) return '';
                    return `<div class="short_text">
                            ${item.field_2.replaceAll("\n", "<br>")}
                            </div>`
                },
            },
            {
                field: 'field_3',
                width: '100px',
                title: 'Field 3',
                filterable: {
                    cell: {
                        showOperators: false,
                    },
                },
                template: function(item) {
                    if (!item.field_3) return '';
                    return `<div class="short_text">
                            ${item.field_3.replaceAll("\n", "<br>")}
                            </div>`
                },
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
    
    $("#message-grid").on("dblclick", "td[role='gridcell']", function(e) {
        var text = $(this).find(".text");
        if (text.length) text.selectText();
        else $(this).selectText();
    });

    $(document).keydown(function(e) {
        if (e.key === "Escape") {
            selectedDataItems = [];
            selectedItemIds = [];
            selectedItemImsi = [];
            $("#message-grid").data("kendoGrid").clearSelection();
        }
    });

    window.optimize_grid(['#message-grid']);

}