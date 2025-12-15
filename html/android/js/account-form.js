function initAccountForm() {
    return $('#account-form').kendoForm({
        orientation: 'vertical',
        // formData: {
        //     files: []
        // },
        layout: 'grid',
        grid: { cols: 12, gutter: '15px 10px' },
        buttonsTemplate: '',
        items: [
            {
                field: "limit",
                label: "Message Sending Limit :",
                editor: 'NumericTextBox',
                editorOptions: {
                    format: "n0",
                    min: -1
                },
                colSpan: 6
            }, {
                field: "cooldown",
                label: "Message Sending Pause:",
                editor: 'NumericTextBox',
                editorOptions: {
                    format: "n0",
                    min: 1
                },
                colSpan: 6
            }, {
                field: "sep0",
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15'></div>"
            }, {
                field: "file",
                label: "",
                colSpan: 12,
                editor: function(container, options) {
                    $('<input type="file" name="' + options.field + '" id="' + options.field + '"/>')
                        .appendTo(container)
                        .kendoUpload({
                            async: {
                                saveUrl: `${api_base_url}/api/v1/android/accounts/upload`,
                                removeUrl: `${api_base_url}/api/v1/android/accounts/remove`,
                                removeField: 'file_name',
                                autoUpload: true,
                                withCredentials: false,
                            },
                            validation: { allowedExtensions: [".gz"] },
                            multiple: true,

                            beforeSend: function (xhr) {
                                xhr.setRequestHeader("Authorization", `${token_type} ${access_token}`);
                            },

                            // Добавляем строки в грид по мере успешной загрузки файлов
                            success: function(e) {
                                if (e.operation !== 'upload') return;
                                let model = options.model;
                                const file_name = e.response.file_name;
                                if ('files' in model) {
                                    model.files.push(file_name);
                                } else {
                                    model.set("files", [file_name]);
                                }
                            },
                            // Пользователь удаляет файл из Upload → удаляем и строку из грида
                            remove: function(e) {
                                // console.log(e);
                                // (e.files || []).forEach(file => {
                                //     const item = link.get(file.uid);
                                //     if (item) {
                                //         ds.remove(item);
                                //         link.delete(file.uid);
                                //     } else {
                                //         const name = file._serverFileName || file.name;
                                //         const toRemove = ds.data().find(it =>
                                //             it.file_name === name && (it.isNew ? it.isNew() : !it.id)
                                //         );
                                //         if (toRemove) ds.remove(toRemove);
                                //     }
                                //
                                //     if (!e.data) e.data = {};
                                //     e.data.file_name = file._serverFileName || file.name;
                                // });

                                // sync делается в save грида
                            },
                            error: function(e) {
                                console.warn('Upload error', e);
                            }
                        });
                },
                validation: { required: true }
            },
            {
                field: 'sep1',
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15 mt-n3'></div>",
            }
        ],
        buttonsTemplate: "<div class='w-100 mt-15 mb-n15 d-flex'><button id='form-save' type='submit' class='k-button k-button-lg k-rounded-md k-button-solid k-button-solid-primary me-4'>Submit</button><button id='window-cancel' class='k-button k-button-lg k-rounded-md k-button-solid k-button-solid-base k-form-clear ms-4'>Cancel</button></div>",
        submit: function(e) {
            e.preventDefault();
            let model = e.model;
            console.log(model);
            let grid = $('#accounts-grid').data('kendoGrid');
            let token = window.isAuth;
            try {
                let { access_token, token_type } = token;
                $.ajax({
                    url: `${api_base_url}/api/v1/android/accounts/`,
                    type: "POST",
                    dataType: 'json',
                    data: JSON.stringify(model),
                    contentType: 'application/json;charset=UTF-8',
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader ("Authorization", `${token_type} ${access_token}`);
                    },
                    success: function(data) {

                    },
                    error: function(jqXHR, textStatus, ex) {

                    }
                }).then(function(data) {
                    if (true || data.id) {
                    //     $("#campaign-notification").kendoNotification({
                    //         type: "warning",
                    //         position: {
                    //             top: 54,
                    //             right: 8
                    //         },
                    //         width: "auto",
                    //         allowHideAfter: 1000,
                    //         autoHideAfter: 5000
                    //     });
                        // $("#campaign-notification").getKendoNotification().show("All changes are saved");
                        grid.dataSource.read();
                        $("#account-window").data("kendoWindow").close();
                        $("#account-form").getKendoForm().clear();
                    }
                });
            } catch (error) {
                console.warn(error);
            }
        },
        clear: function(e) {
            $("#account-window").data("kendoWindow").close();
        }
    });
}

function showAccountEditForm(model) {
    return $('#form-edit-account').kendoForm({
        orientation: 'vertical',
        formData: model,
        layout: 'grid',
        grid: { cols: 12, gutter: '15px 10px' },
        buttonsTemplate: '',
        items: [
            {
                field: "limit",
                label: "Message Sending Limit :",
                editor: 'NumericTextBox',
                editorOptions: {
                    format: "n0",
                    min: 1
                },
                colSpan: 6
            }, {
                field: "cooldown",
                label: "Message Sending Pause:",
                editor: 'NumericTextBox',
                editorOptions: {
                    format: "n0",
                    min: 1
                },
                colSpan: 6
            }, {
                field: "sep0",
                colSpan: 12,
                label: false,
                editor: "<div class='separator mx-n15'></div>"
            }
        ],
        change: function (e) {},
    });
}
