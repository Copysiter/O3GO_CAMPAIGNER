function showEditForm(model) {
    return $('#form-edit-services').kendoForm({
        orientation: 'vertical',
        formData: model,
        layout: 'grid',
        grid: { cols: 12, gutter: '15px 10px' },
        buttonsTemplate: '',
        items: [
            {
                field: 'name',
                label: 'Name',
                colSpan: 6,
            },
            {
                field: 'alias',
                label: 'Alias',
                colSpan: 6,
            },
            {
                field: 'sep1',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15'></div>",
            },
            {
                field: 'color_bg',
                label: 'Background',
                editor: function(container, options) {
                    $('<div id="colorBg" name="' + options.field + '" data-bind="value: ' +  options.field + '" data-role="colorpicker" class="k-colorpicker k-picker k-icon-picker k-picker-solid k-picker-md k-rounded-md" role="combobox" aria-keyshortcuts="Enter" aria-label="Current selected color is #d9d9d9" tabindex="0"></div>')
                        .appendTo(container);
                },
                colSpan: 6
            },
            {
                field: 'color_txt',
                label: 'Text Color',
                editor: function(container, options) {
                    $('<div id="colorTxt" name="' + options.field + '" data-bind="value: ' +  options.field + '" data-role="colorpicker" class="k-colorpicker k-picker k-icon-picker k-picker-solid k-picker-md k-rounded-md" role="combobox" aria-keyshortcuts="Enter" aria-label="Current selected color is #424242" tabindex="0"></div>')
                        .appendTo(container);
                },
                colSpan: 6
            },
            {
                field: 'sep2',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15 mt-n3'></div>",
            },
            {
                field: 'text',
                colSpan: 6,
                label: false,
                editor: "<div class='mt-3'>Enabled:</div>",
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
            {
                field: 'sep3',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15 mt-n3'></div>",
            },
        ],
        change: function (e) {},
    });
}
