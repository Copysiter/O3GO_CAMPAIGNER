function showEditForm(model) {
    let token = window.isAuth;
    let { access_token, token_type } = token;
    return $('#form-edit-connections').kendoForm({
        orientation: 'vertical',
        formData: model,
        layout: 'grid',
        grid: { cols: 12, gutter: '15px 10px' },
        buttonsTemplate: '',
        items: [
            {
                field: 'name',
                label: 'Name:',
                colSpan: 6,
            },
            {
                field: 'user_id',
                label: 'User',
                colSpan: 6,
                editor: 'DropDownList',
                editorOptions: {
                    dataSource: {
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
                    },
                    dataTextField: 'text',
                    dataValueField: 'value',
                    valuePrimitive: true,
                    downArrow: true,
                    animation: false,
                    autoClose: false,
                    validation: { required: true },
                    dataBound: function (e) {
                        $('#connections-grid')
                            .data('kendoGrid')
                            .autoFitColumn('user_id');
                    },
                    change: function (e) {
                        $('#connections-grid')
                            .data('kendoGrid')
                            .autoFitColumn('user_id');
                    },
                },
            },
            {
                field: 'sep1',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15'></div>",
            },

            {
                field: 'login',
                label: 'Login',
                colSpan: 6,
            },
            {
                field: 'password',
                label: 'Password',
                colSpan: 6,
                hidden: true,
            },
            {
                field: 'sep2',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15'></div>",
            },
            {
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
                        <button class="k-button k-button-solid-base k-button-solid k-button-md k-rounded-md" onclick="addNew('${value}', 'api_keys')">Append</button>
                        </p>
                        `;
                    },
                },
                colSpan: 12,
            },
            {
                field: 'sep3',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15'></div>",
            },
            {
                field: 'text',
                colSpan: 6,
                label: false,
                editor: "<div class='mt-3'>Active:</div>",
            },
            {
                field: 'is_active',
                label: '',
                editor: 'Switch',
                editorOptions: {
                    width: 70,
                },
                colSpan: 6,
            },
        ],
        change: function (e) {},
    });
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
    })
        .done(function (result) {
        let widget = $(`#${id}`).data('kendoMultiSelect');
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
        document.querySelector('.k-selection-multiple').lastChild.value = '';
    })
    .fail(function (result) {

    });
}
