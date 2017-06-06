'use strict';

import React, { Component } from 'react';
import { translate } from 'react-i18next';
import { withSectionHelpers, Title } from '../lib/page'
import { withForm, Form, FormSendMethod, InputField, TextArea, ButtonRow, Button, TreeTableSelect } from '../lib/form';
import axios from '../lib/axios';
import { withErrorHandling, withAsyncErrorHandler } from '../lib/error-handling';
import interoperableErrors from '../../../shared/interoperable-errors';

@translate()
@withForm
@withSectionHelpers
@withErrorHandling
export default class CreateOrEdit extends Component {
    constructor(props) {
        super(props);

        this.initFormState();
    }

    isEditGlobal() {
        return this.nsId === 1;
    }

    removeNsIdSubtree(data) {
        for (let idx = 0; idx < data.length; idx++) {
            const entry = data[idx];

            if (entry.key === this.nsId) {
                data.splice(idx, 1);
                return true;
            }

            if (this.removeNsIdSubtree(entry.children)) {
                return true;
            }
        }
    }

    @withAsyncErrorHandler
    async loadTreeData() {
        axios.get("/namespaces/rest/namespacesTree")
            .then(response => {

                const data = [response.data];

                if (this.props.edit && !this.isEditGlobal()) {
                    this.removeNsIdSubtree(data);
                }

                this.setState({
                    treeData: data
                });
            });
    }

    componentDidMount() {
        const edit = this.props.edit;

        if (edit) {
            this.nsId = parseInt(this.props.match.params.nsId);
            this.getFormValuesFromURL(`/namespaces/rest/namespaces/${this.nsId}`, data => {
                if (data.parent) data.parent = data.parent.toString();
            });
        } else {
            this.populateFormValues({
                name: '',
                description: '',
                parent: null
            });
        }

        if (!this.isEditGlobal()) {
            this.loadTreeData();
        }
    }

    validateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value']).trim()) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!this.isEditGlobal()) {
            if (!state.getIn(['parent', 'value'])) {
                state.setIn(['parent', 'error'], t('Parent Namespace must be selected'));
            } else {
                state.setIn(['parent', 'error'], null);
            }
        }
    }

    async submitHandler() {
        const t = this.props.t;
        const edit = this.props.edit;

        let sendMethod, url;
        if (edit) {
            sendMethod = FormSendMethod.PUT;
            url = `/namespaces/rest/namespaces/${this.nsId}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = '/namespaces/rest/namespaces'
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving namespace ...'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
                if (data.parent) data.parent = parseInt(data.parent);
            });

            if (submitSuccessful) {
                this.navigateToWithFlashMessage('/namespaces', 'success', t('Namespace saved'));
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }

        } catch (error) {
            if (error instanceof interoperableErrors.LoopDetectedError) {
                this.disableForm();
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Your updates cannot be saved.')}</strong>{' '}
                        {t('There has been a loop detected in the assignment of the parent namespace. This is most likely because someone else has changed the parent of some namespace in the meantime. Refresh your page to start anew with fresh data. Please note that your changes will be lost.')}
                    </span>
                );
                return;
            }

            throw error;
        }
    }

    async deleteHandler() {
        this.setFormStatusMessage('Deleting namespace');
        this.setFormStatusMessage();
    }

    render() {
        const t = this.props.t;
        const edit = this.props.edit;

        return (
            <div>
                <Title>{edit ? t('Edit Namespace') : t('Create Namespace')}</Title>

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')}/>

                    {!this.isEditGlobal() &&
                    <TreeTableSelect id="parent" label={t('Parent Namespace')} data={this.state.treeData}/>}

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        {edit && <Button className="btn-danger" icon="remove" label={t('Delete Namespace')}
                                         onClickAsync={::this.deleteHandler}/>}
                    </ButtonRow>
                </Form>
            </div>
        );
    }
}
