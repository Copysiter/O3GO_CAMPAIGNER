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

        $('#devices-grid').kendoGrid({
            dataSource: {
                transport: {
                    read: {
                        url: `http://${api_base_url}/api/v1/devices/`,
                        type: 'GET',
                        beforeSend: function (request) {
                            request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                        },
                        dataType: 'json',
                    },
                    create: {
                        url: `http://${api_base_url}/api/v1/devices/`,
                        type: 'POST',
                        dataType: 'json',
                        contentType: 'application/json',
                        beforeSend: function (request) {
                            request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                        },
                    },
                    update: {
                        url: function (options) {
                            console.log(options);
                            return `http://${api_base_url}/api/v1/devices/${options.id}`;
                        },

                        type: 'PUT',
                        dataType: 'json',
                        contentType: 'application/json',
                        beforeSend: function (request) {
                            request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                        },
                    },
                    destroy: {
                        url: function (options) {
                            console.log(options);
                            return `http://${api_base_url}/api/v1/devices/${options.id}`;
                        },

                        type: 'DELETE',
                        dataType: 'json',
                        contentType: 'application/json',
                        beforeSend: function (request) {
                            request.setRequestHeader('Authorization', `${token_type} ${access_token}`);
                        },
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
                            id: { type: 'number', editable: false },
                            name: {
                                type: 'string',
                                editable: true
                            },
                            ext_id: {
                                type: 'string',
                                editable: true,
                                validation: { required: true },
                            },
                            operator: { type: 'string', editable: true },
                            root: { type: 'boolean', editable: true },
                            actions: { type: 'object', editable: false },
                        },
                    },
                },
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
            edit: function (e) {
                form.data('kendoForm').setOptions({
                    formData: e.model,
                });
                popup.setOptions({
                    title: e.model.id ? 'Edit Device' : 'New Device',
                });
                popup.center();
            },
            editable: {
                mode: 'popup',
                template: kendo.template($('#devices-popup-editor').html()),
                window: {
                    width: 480,
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
            save: function (e) {
                // e.model.id = e.sender.dataSource.data().length;
                e.model.is_superuser = e.model.is_superuser == 'true';
            },
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
                    field: 'id',
                    title: '#',
                    // width: 33,
                    filterable: false,
                },
                {
                    field: 'name',
                    title: 'Name',
                    filterable: {
                        cell: {
                            inputWidth: 0,
                            showOperators: true,
                            operator: 'eq',
                        },
                    },
                },
                {
                    field: 'ext_id',
                    title: 'Ext ID',
                    filterable: {
                        cell: {
                            inputWidth: 0,
                            showOperators: true,
                            operator: 'eq',
                        },
                    },
                },
                {
                    field: 'root',
                    title: 'Root',
                    // width: 44,
                    template: "<div class='marker block #=root == 1 ? 'green' : 'red'#'><i></i></div>",
                    filterable: false,
                },
                {
                    field: 'operator',
                    title: 'Operator',
                    filterable: {
                        cell: {
                            inputWidth: 0,
                            showOperators: true,
                            operator: 'eq',
                        },
                    },
                },
                {
                    command: [
                        {
                            name: 'edit',
                            iconClass: {
                                edit: 'k-icon k-i-edit',
                                update: '',
                                cancel: '',
                            },
                            text: {
                                edit: '',
                                update: 'Save',
                                cancel: 'Cancel',
                            },
                        },
                        { name: 'destroy', text: '' },
                    ],
                    title: '',
                    // width: 86,
                },
                {},
            ]
        });
        window.optimize_grid(['#devices-grid']);
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

        $('#devices-grid').on('dblclick', "td[role='gridcell']", function (e) {
            var text = $(this).find('.text');
            if (text.length) text.selectText();
            else $(this).selectText();
        });

        $(document).keydown(function (e) {
            if (e.key === 'Escape') {
                selectedDataItems = [];
                selectedItemIds = [];
                selectedItemImsi = [];
                $('#devices-grid').data('kendoGrid').clearSelection();
            }
        });

    } catch (error) {
        console.warn(error);
    }
}
