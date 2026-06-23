window.initMessageGrid = function(id) {

    let messageShowLoader = true;
    let messageResizeColumn = false;

    window.selectedMessageItem = null;
    window.selectedMessageItems = [];

    var existingGrid = $('#message-grid').data("kendoGrid");
    if (existingGrid) {
        existingGrid.destroy();
        $('#message-grid').empty();
    }

    $('#message-grid').kendoGrid({
        dataSource: {
            transport: {
                read: {
                    //url: `${campaigner_api_addr}/api/v1/campaigns/${id}`,
                    url: `${api_base_url}/api/v1/campaigns/${id}/campaign_dst`,
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
                        id: { type: 'number' },
                        dst_addr: { type: 'string' },
                        text: { type: 'string' },
                        field_1: { type: 'string' },
                        field_2: { type: 'string' },
                        field_3: { type: 'string' },
                        status: { type: 'number' },
                        create_ts: { type: 'date' },
                        sent_ts: { type: 'date' },
                        expire_ts: { type: 'date' },
                        // empty: {}
                    },
                },
            },
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
        selectable: "multiple, row",
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
        change: function (e) {
            window.selectedMessageItems = [];
            let rows = e.sender.select();
            window.selectedMessageItem = e.sender.dataItem(rows[0]);
            for (let i = 0; i < rows.length; i++) {
                let dataItem = e.sender.dataItem($(rows[i]));
                if (window.selectedMessageItems.indexOf(dataItem) == -1) {
                    window.selectedMessageItems.push(dataItem);
                }
            }
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
                field: 'score',
                width: '100px',
                title: 'DST Number Score',
                template: function(item) {
                    if (item.score === null || item.score === undefined) {
                        return "<span class='info info-sm info-light'>unknown</span>";
                    } else if (item.score === -1) {
                        return "<span class='info info-sm info-red'>error</span>";
                    } else if (item.score < 0.4) {
                        return "<span class='info info-sm info-green'>" + item.score + "</span>";
                    } else if (item.score < 0.7) {
                        return "<span class='info info-sm info-orange'>" + item.score + "</span>";
                    } else {
                        return "<span class='info info-sm info-red'>" + item.score + "</span>";
                    }
                },
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
            {
                field: 'create_ts',
                title: 'Created',
                format: '{0: yyyy-MM-dd HH:mm:ss}',
                filterable: false,
                sortable: false
            },
            {
                field: 'sent_ts',
                title: 'Sent',
                format: '{0: yyyy-MM-dd HH:mm:ss}',
                filterable: false,
                sortable: false
            },
            {
                field: 'expire_ts',
                title: 'Expire',
                format: '{0: yyyy-MM-dd HH:mm:ss}',
                filterable: false,
                sortable: false
            },
            {
                field: 'error',
                title: 'Error',
                filterable: false,
                sortable: false
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

    if (window.initMessageContextMenu) {
        window.initMessageContextMenu();
    }

}

window.deleteSelectedMessages = function() {
    if (!window.selectedCampaignItem || window.selectedMessageItems.length === 0) return;
    var body = window.selectedMessageItems.length > 1
        ? "Are you sure you want to delete selected Messages?"
        : "Are you sure you want to delete selected Message?";
    kendo.confirm(`<div style='padding:5px 10px 0 10px;'>${body}</div>`)
        .done(function() {
            $.ajax({
                url: `${api_base_url}/api/v1/campaigns/${window.selectedCampaignItem.id}/campaign_dst`,
                type: "DELETE",
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify({ ids: window.selectedMessageItems.map(obj => parseInt(obj.id)) }),
                dataType: 'json',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader("Authorization", `${token_type} ${access_token}`);
                },
                success: function(data) {
                },
                error: function(jqXHR, textStatus, ex) {
                }
            }).then(function(data) {
                if (data) {
                    var grid = $("#message-grid").data("kendoGrid");
                    window.selectedMessageItem = null;
                    window.selectedMessageItems = [];
                    grid.clearSelection();
                    grid.dataSource.read();
                }
            });
        })
        .fail(function() {
        });
};
