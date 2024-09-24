window.initGrid = function() {
    let timer = null;
    let resizeColumn = false;
    let showLoader = true;
    // let { access_token, token_type } =
    //     window.storageToken.options.offlineStorage.getItem();
    let token = window.isAuth;

    try {
        let { access_token, token_type } = token;

        var popup;
        var service_columns = []
        autoFitColumn = function (grid) {
            setTimeout(function () {
                // grid.autoFitColumn('id');
                grid.autoFitColumn('name');
                grid.autoFitColumn('login');
                grid.autoFitColumn('balance');
                grid.autoFitColumn('balance_lock');
                grid.autoFitColumn('is_superuser');
                grid.autoFitColumn('connections');
            });
        };

        $.ajax({
            type: 'GET',
            url: `http://${api_base_url}/api/v1/services/?filters[0][field]=is_active&filters[0][operator]=istrue`,
            headers: {
                Authorization: `${token_type} ${access_token}`,
                accept: 'application/json',
            },
        })
            .done(function (result) {
                data = result.data;
                console.log(data);
                data.forEach((obj) => {
                    service_columns.push({
                        title: obj.name,
                        headerTemplate: '<span>' + (obj.name ? obj.name : obj.alias) + '</span>',
                        headerAttributes: {
                            style: 'color:' + obj.color_txt + ';background:' + obj.color_bg + ';',
                        },
                        filterable: {
                            mode: 'menu',
                        },
                        columns: [{
                            field: 'start_count_' + obj.id,
                            title: "<span class='rotate'>start</span>",
                            rowSpan: 2,
                            sortable: true,
                            filterable: false,
                            attributes: {
                                style: `background:\\${obj.color_bg}44;`,
                            },
                            headerAttributes: {
                                class: 'rotate-cell',
                                style: 'color:' + obj.color_txt + ';background:' + obj.color_bg + ';',
                            },
                            template: function(item) {
                                if (item.hasOwnProperty('start_count_' + obj.id)) {
                                    return item['start_count_' + obj.id];
                                } else {
                                    return 0;
                                }
                            }
                        }, {
                            field: 'number_count_' + obj.id,
                            title: "<span class='rotate'>number</span>",
                            rowSpan: 2,
                            sortable: true,
                            filterable: false,
                            attributes: {
                                style: `background:\\${obj.color_bg}44;`,
                            },
                            headerAttributes: {
                                class: 'rotate-cell',
                                style: 'color:' + obj.color_txt + ';background:' + obj.color_bg + ';',
                            },
                            template: function(item) {
                                if (item.hasOwnProperty('number_count_' + obj.id)) {
                                    return item['number_count_' + obj.id];
                                } else {
                                    return 0;
                                }
                            }
                        }, {
                            field: 'code_count_' + obj.id,
                            title: "<span class='rotate'>code</span>",
                            rowSpan: 2,
                            sortable: true,
                            filterable: false,
                            attributes: {
                                style: `background:\\${obj.color_bg}44;`,
                            },
                            headerAttributes: {
                                class: 'rotate-cell',
                                style: 'color:' + obj.color_txt + ';background:' + obj.color_bg + ';',
                            },
                            template: function(item) {
                                if (item.hasOwnProperty('code_count_' + obj.id)) {
                                    return item['code_count_' + obj.id];
                                } else {
                                    return 0;
                                }
                            }
                        }, {
                            field: 'code_pct_' + obj.id,
                            title: "<span class='rotate'>code, %</span>",
                            rowSpan: 2,
                             sortable: false,
                            filterable: false,
                            attributes: {
                                style: `background:\\${obj.color_bg}66;`,
                            },
                            headerAttributes: {
                                class: 'rotate-cell',
                                style: 'color:' + obj.color_txt + ';background:' + obj.color_bg + ';',
                            },
                            template: function(item) {
                                if (
                                    item.hasOwnProperty('code_count_' + obj.id) &&
                                    item.hasOwnProperty('number_count_' + obj.id) &&
                                    item['code_count_' + obj.id] > 0 &&
                                    item['number_count_' + obj.id] > 0
                                ) {
                                    console.log(item['code_count_' + obj.id]/item['number_count_' + obj.id]*100)
                                    return (item['code_count_' + obj.id]/item['number_count_' + obj.id]*100).toFixed(1);
                                } else {
                                    return 0;
                                }
                            }
                        }, {
                            field: 'no_code_count_' + obj.id,
                            title: "<span class='rotate'>no code</span>",
                            rowSpan: 2,
                            sortable: true,
                            filterable: false,
                            attributes: {
                                style: `background:\\${obj.color_bg}44;`,
                            },
                            headerAttributes: {
                                class: 'rotate-cell',
                                style: 'color:' + obj.color_txt + ';background:' + obj.color_bg + ';',
                            },
                            template: function(item) {
                                if (item.hasOwnProperty('no_code_count_' + obj.id)) {
                                    return item['no_code_count_' + obj.id];
                                } else {
                                    return 0;
                                }
                            }
                        }, {
                            field: 'bad_count_' + obj.id,
                            title: "<span class='rotate'>bad</span>",
                            rowSpan: 2,
                            sortable: true,
                            filterable: false,
                            attributes: {
                                style: `background:\\${obj.color_bg}44;`,
                            },
                            headerAttributes: {
                                class: 'rotate-cell',
                                style: 'color:' + obj.color_txt + ';background:' + obj.color_bg + ';',
                            },
                            template: function(item) {
                                if (item.hasOwnProperty('bad_count_' + obj.id)) {
                                    return item['bad_count_' + obj.id];
                                } else {
                                    return 0;
                                }
                            }
                        }]
                    });
                });
                $('#report-grid').kendoGrid({
                    dataSource: {
                        transport: {
                            read: {
                                url: `http://${api_base_url}/api/v1/report/`,
                                type: 'GET',
                                beforeSend: function (request) {
                                    request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                                },
                                dataType: 'json',
                            },
                            // parameterMap: function (options, type) {
                            //     return kendo.stringify(options);
                            // },
                            parameterMap: function (data, type) {
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

                                if (type === 'read') return data;
                                return kendo.stringify(data);
                            },
                        },
                        // data: fakedata,
                        pageSize: 100,
                        serverPaging: true, // true
                        serverFiltering: true, // true
                        serverSorting: true, // true
                        schema: {
                            data: function (response) {
                                if (response.data !== undefined) return response.data;
                                else return response;
                            },
                            total: 'total',
                            model: {
                                id: 'id',
                                fields: {
                                    id: { type: 'number'},
                                    api_key: { type: 'string' },
                                    device_id: { type: 'number' },
                                    device_ext_id: { type: 'string' },
                                    device_operator: { type: 'string' },
                                    timestamp: { type: 'date' },
                                    ts_1: { type: 'date'},
                                },
                            },
                        },
                        filter: { field: 'period', operator: "eq", value: '0d' },
                        requestStart: function (e) {
                            setTimeout(function (e) {
                                if (showLoader) $('.k-loading-mask').show();
                            });
                        },
                    },
                    height: '100%',
                    reorderable: true,
                    resizable: false,
                    selectable: 'row',
                    persistSelection: true,
                    sortable: true,
                    dataBinding: function (e) {
                        clearTimeout(timer);
                    },
                    dataBound: function (e) {
                        showLoader = true;
                        // if (!resizeColumn) {
                        //     autoFitColumn(e.sender);
                        //     resizeColumn = true;
                        // }

                        // timer = setTimeout(function () {
                        //     showLoader = false;
                        //     e.sender.dataSource.read();
                        // }, 30000);
                    },
                    filterable: {
                        mode: 'menu',
                        extra: false,
                        operators: {
                            string: {
                                eq: 'Equal to',
                                neq: 'Not equal to',
                                startswith: 'Starts with',
                                endswith: 'Ends with',
                                contains: 'Contains',
                                doesnotcontain: 'Does not contain',
                                isnullorempty: 'Has no value',
                                isnotnullorempty: 'Has value',
                            },
                            number: {
                                eq: 'Equal to',
                                neq: 'Not equal to',
                                gt: 'Greater than',
                                gte: 'Greater than or equal to',
                                lt: 'Less than',
                                lte: 'Less than or equal to',
                            },
                        },
                    },
                    pageable: {
                        refresh: true,
                        pageSizes: [100, 250, 500],
                    },
                    change: function (e) {},
                    columns: [
                        {
                            field: 'alert',
                            title: ' ',
                            filterable: false,
                            sortable: false,
                            template: '# if (timedelta > 300) { #<div class="mdi mdi-alert text-red fs-18 mx-n2 my-n5"></div># } else { ## } #'
                        },
                        {
                            field: 'api_key',
                            title: 'API Key',
                            filterable: {
                                cell: {
                                    inputWidth: 0,
                                    showOperators: true,
                                    operator: 'contains',
                                },
                            },
                        },
                        {
                            field: 'device_name',
                            title: 'Device',
                            sortable: false,
                            filterable: {
                                cell: {
                                    inputWidth: 0,
                                    showOperators: true,
                                    operator: 'contains',
                                },
                            },
                            /*
                            filterable: {
                                multi: true,
                                dataSource: {
                                    transport: {
                                        read: {
                                            url: `http://${api_base_url}/api/v1/options/device`,
                                            type: 'GET',
                                            beforeSend: function (request) {
                                                request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                                            },
                                            dataType: 'json',
                                        }
                                    }
                                },
                                itemTemplate: function(e) {
                                    if (e.field == "all") {
                                        return "";
                                    } else {
                                        return "<div class=''><label class='d-flex align-items-center py-8 ps-3 border-bottom cursor-pointer'><input type='checkbox' name='" + e.field + "' value='#=value#' class='k-checkbox k-checkbox-md k-rounded-md'/><span class='ms-8'>#=text#</span></label></div>"
                                    }
                                }
                            },
                            */
                            template: '# if (device_name) { ##: device_name ## } else { ## } #'
                        },
                        {
                            field: 'device_ext_id',
                            title: 'Ext ID',
                            sortable: false,
                            filterable: {
                                cell: {
                                    inputWidth: 0,
                                    showOperators: true,
                                    operator: 'contains',
                                },
                            },
                        },
                        {
                            field: 'device_root',
                            title: 'Root',
                            sortable: false,
                            // width: 44,
                            template: "<div class='marker block #=device_root == 1 ? 'green' : 'red'#'><i></i></div>",
                            filterable: false,
                        },
                        {
                            field: 'device_operator',
                            title: 'Operator',
                            sortable: false,
                            filterable: {
                                cell: {
                                    inputWidth: 0,
                                    showOperators: true,
                                    operator: 'contains',
                                },
                            },
                        }].concat(service_columns).concat([{
                            field: 'timestamp',
                            title: 'Last Activity',
                            // width: 33,
                            sortable: true,
                            filterable: false,
                            // filterable: {
                            //     cell: {
                            //         inputWidth: 0,
                            //         showOperators: true,
                            //         operator: 'eq',
                            //     },
                            // },
                            format: '{0: yyyy-MM-dd HH:mm:ss}',
                        },
                        {
                            field: 'ts_1',
                            title: 'Last Success Code',
                            // width: 33,
                            filterable: false,
                            format: '{0: yyyy-MM-dd HH:mm:ss}',
                        },
                        {
                            field: 'info_1',
                            title: 'Info 1',
                            sortable: false,
                            filterable: {
                                cell: {
                                    inputWidth: 0,
                                    showOperators: true,
                                    operator: 'contains',
                                },
                            },
                        },
                        {
                            field: 'info_2',
                            title: 'Info 2',
                            sortable: false,
                            filterable: {
                                cell: {
                                    inputWidth: 0,
                                    showOperators: true,
                                    operator: 'contains',
                                },
                            },
                        },
                        {
                            field: 'info_3',
                            title: 'Info 3',
                            sortable: false,
                            filterable: {
                                cell: {
                                    inputWidth: 0,
                                    showOperators: true,
                                    operator: 'contains',
                                },
                            },
                        },
                        {},
                    ]),
                });
                window.optimize_grid(['#report-grid']);
            })
            .fail(function (result) {

            });
        jQuery.fn.selectText = function () {
            var doc = document;
            var element = this[0];
            $('input, textarea, select').blur();
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

        $('#report-grid').on('dblclick', "td[role='gridcell']", function (e) {
            var text = $(this).find('.text');
            if (text.length) text.selectText();
            else $(this).selectText();
        });

        $(document).keydown(function (e) {
            if (e.key === 'Escape') {
                selectedDataItems = [];
                selectedItemIds = [];
                selectedItemImsi = [];
                $('#report-grid').data('kendoGrid').clearSelection();
            }
        });

    } catch (error) {
        console.warn(error);
    }
}
