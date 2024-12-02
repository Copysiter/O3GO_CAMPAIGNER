function showEditForm(model) {
    let user_field = window.isAuth.user.is_superuser ? [{
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
    }] : []

    return $('#form-edit-tags').kendoForm({
        orientation: 'vertical',
        formData: model,
        layout: 'grid',
        grid: { cols: 12, gutter: '15px 10px' },
        buttonsTemplate: '',
        items: [
            {
                field: 'name',
                label: 'Name',
                colSpan: window.isAuth.user.is_superuser ? 6 : 12,
                validation: { required: true },
            }].concat(user_field).concat([{
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
                        <button class="k-button k-button-solid-base k-button-solid k-button-md k-rounded-md" onclick="addNew('${value}', 'form-edit-tags')">Append</button>
                        </p>
                        `;
                    },
                },
                colSpan: 12,
            },
            {
                field: 'color_txt',
                label: 'Text Color',
                colSpan: 6,
                editor: 'ColorPicker',
                editorOptions: {
                    views: ["gradient"],
                    preview: false,
                    value: "#FFFFFF"
                }
            },
            {
                field: 'color_bg',
                label: 'Background',
                colSpan: 6,
                editor: 'ColorPicker',
                editorOptions: {
                    views: ["gradient"],
                    preview: false,
                    value: "#000000"
                }
            },
            {
                field: 'description',
                label: 'Description',
                editor: 'TextArea',
                editorOptions: {
                    rows: 3
                },
                colSpan: 12,
            },
            {
                field: 'sep1',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15 mt-n3'></div>",
            },
        ]),
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
