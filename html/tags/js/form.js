function showEditForm(model) {
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
                colSpan: 12,
                validation: { required: true }
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
                field: 'sep1',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15 mt-n3'></div>",
            },
        ],
        change: function (e) {},
    });
}
