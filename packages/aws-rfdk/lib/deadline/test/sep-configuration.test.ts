/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  expect as cdkExpect,
  haveResource,
  haveResourceLike,
} from '@aws-cdk/assert';
import {
  GenericWindowsImage,
  InstanceClass,
  InstanceSize,
  InstanceType,
  Vpc,
} from '@aws-cdk/aws-ec2';
import {
  ContainerImage,
} from '@aws-cdk/aws-ecs';
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
} from '@aws-cdk/aws-iam';
import { Bucket } from '@aws-cdk/aws-s3';
import {
  App,
  Stack,
} from '@aws-cdk/core';
import {
  IRenderQueue,
  IVersion,
  RenderQueue,
  Repository,
  SEPConfigurationSetup,
} from '../lib';
import {
  SEPSpotFleet,
} from '../lib/sep-spotfleet';


describe('SEPConfigurationSetup', () => {
  let stack: Stack;
  let vpc: Vpc;
  let renderQueue: IRenderQueue;
  let version: IVersion;
  let app: App;
  let fleetRole: Role;
  let fleet: SEPSpotFleet;
  let groupPools: {
    [groupName: string]: string[];
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'stack', {
      env: {
        region: 'us-east-1',
      },
    });
    vpc = new Vpc(stack, 'Vpc');

    version = {
      majorVersion: 10,
      minorVersion: 1,
      releaseVersion: 12,
      linuxInstallers: {
        patchVersion: 0,
        repository: {
          objectKey: 'testInstaller',
          s3Bucket: new Bucket(stack, 'InstallerBucket'),
        },
      },
      linuxFullVersionString: () => '10.1.12.0',
    };

    renderQueue = new RenderQueue(stack, 'RQ', {
      vpc,
      images: { remoteConnectionServer: ContainerImage.fromAsset(__dirname) },
      repository: new Repository(stack, 'Repository', {
        vpc,
        version,
      }),
      version,
    });

    fleetRole = new Role(stack, 'FleetRole', {
      assumedBy: new ServicePrincipal('spotfleet.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(stack, 'AmazonEC2SpotFleetTaggingRole', 'arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetTaggingRole'),
      ],
    });

    fleet = new SEPSpotFleet(stack, 'spotFleet1', {
      vpc,
      renderQueue: renderQueue,
      fleetRole,
      deadlineGroups: [
        'group_name1',
      ],
      instanceTypes: [
        InstanceType.of(InstanceClass.T2, InstanceSize.SMALL),
      ],
      workerMachineImage: new GenericWindowsImage({
        'us-east-1': 'ami-any',
      }),
      targetCapacity: 1,
    });

    groupPools = {
      ['group_name1']: ['pool1', 'pool2'],
    };
  });

  test('created correctly', () => {
    // WHEN
    new SEPConfigurationSetup(stack, 'SEPConfigurationSetup', {
      vpc,
      renderQueue: renderQueue,
      version,
      spotFleetOptions: {
        spotFleets: [
          fleet,
        ],
        groupPools,
      },
    });

    // THEN
    cdkExpect(stack).to(haveResource('Custom::RFDK_SEPConfigurationSetup', {
    }));
  });

  test('throws with the same group name', () => {
    // THEN
    expect(() => {
      new SEPConfigurationSetup(stack, 'SEPConfigurationSetup', {
        vpc,
        renderQueue: renderQueue,
        version,
        spotFleetOptions: {
          spotFleets: [
            fleet,
            fleet,
          ],
          groupPools,
        },
      });
    }).toThrowError(/Bad Group Name: group_name1. Group names in Spot Fleet Request Configurations should be unique./);
  });

  test('use selected subnets', () => {
    // WHEN
    new SEPConfigurationSetup(stack, 'SEPConfigurationSetup', {
      vpc,
      vpcSubnets: { subnets: [ vpc.privateSubnets[0] ] },
      renderQueue: renderQueue,
      version,
      spotFleetOptions: {
        spotFleets: [
          fleet,
        ],
        groupPools,
      },
    });

    // THEN
    cdkExpect(stack).to(haveResourceLike('AWS::Lambda::Function', {
      Handler: 'sep-configuration.configureSEP',
      VpcConfig: {
        SubnetIds: [
          {
            Ref: 'VpcPrivateSubnet1Subnet536B997A',
          },
        ],
      },
    }));
  });

  test('creates a custom resource', () => {
    // WHEN
    new SEPConfigurationSetup(stack, 'SEPConfigurationSetup', {
      vpc,
      renderQueue: renderQueue,
      version,
      spotFleetOptions: {
        spotFleets: [
          fleet,
        ],
        groupPools,
      },
    });

    // THEN
    cdkExpect(stack).to(haveResource('Custom::RFDK_SEPConfigurationSetup'));
  });

  test('throws with wrong deadline version', () => {
    // GIVEN
    const oldVersion = {
      majorVersion: 10,
      minorVersion: 1,
      releaseVersion: 9,
      linuxInstallers: {
        patchVersion: 2,
        repository: {
          objectKey: 'testInstaller',
          s3Bucket: new Bucket(stack, 'InstallerBucket2'),
        },
      },
      linuxFullVersionString: () => '10.1.9.2',
    };

    // THEN
    expect(() => {
      new SEPConfigurationSetup(stack, 'SEPConfigurationSetup', {
        vpc,
        renderQueue: renderQueue,
        version: oldVersion,
        spotFleetOptions: {
          spotFleets: [
            fleet,
          ],
          groupPools,
        },
      });
    }).toThrowError(/Minimum supported Deadline version for SEPConfigurationSetup is 10.1.12. Received: 10.1.9./);
  });
});