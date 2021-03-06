# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from typing import (
    List,
    Mapping,
    Optional
)

from aws_rfdk import MongoDbSsplLicenseAcceptance
from aws_rfdk.deadline import UsageBasedLicense


class AppConfig:
    """
    Configuration values for the sample app.

    TODO: Fill these in with your own values.
    """
    def __init__(self):
        # A map of regions to Deadline Client Linux AMIs.
        self.deadline_client_linux_ami_map: Mapping[str, str] = {'region': 'ami-id'}

        # A secret (in binary form) in SecretsManager that stores the UBL certificates in a .zip file.
        self.ubl_certificate_secret_arn: str =\
            ''

        # The UBL licenses to use.
        self.ubl_licenses: List[UsageBasedLicense] = []

        # (Optional) The name of the EC2 keypair to associate with the instances.
        self.key_pair_name: Optional[str] = ''

        # Whether to use MongoDB to back the render farm.
        # If false, then we use Amazon DocumentDB to back the render farm.
        self.deploy_mongo_db: bool = False

        # This is only relevant if deploy_mongo_db is True.
        #
        # Change this value to MongoDbSsplLicenseAcceptance.USER_ACCEPTS_SSPL
        # if you wish to accept the SSPL and proceed with MongoDB deployment.
        self.accept_sspl_license: MongoDbSsplLicenseAcceptance = MongoDbSsplLicenseAcceptance.USER_REJECTS_SSPL


config: AppConfig = AppConfig()
