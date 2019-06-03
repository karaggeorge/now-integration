import {htm} from '@zeit/integration-utils';
import Integration from './integration';

export interface RequireProjectOptions {
  SwitchProjectView?: () => any
}

export const DefaultSwitchProjectView = () => `
  <Page>
    <Box display="flex">
      Please select a project:
      <Box width="5px"/>
      <ProjectSwitcher />
    </Box>
  </Page>
`;

export const requireProject = ({
  SwitchProjectView = DefaultSwitchProjectView
}: RequireProjectOptions = {}) => (app: Integration) => {
  app.use(async ({payload}, next) => {
    const {projectId} = payload;

    if (projectId) {
      next();
    } else {
      return htm`<${SwitchProjectView}/>`;
    }
  });
};
