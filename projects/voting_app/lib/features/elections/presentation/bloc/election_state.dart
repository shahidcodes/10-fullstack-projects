import 'package:equatable/equatable.dart';

import '../../data/models/election_model.dart';

abstract class ElectionState extends Equatable {
  const ElectionState();

  @override
  List<Object?> get props => [];
}

class ElectionInitial extends ElectionState {
  const ElectionInitial();
}

class ElectionLoading extends ElectionState {
  const ElectionLoading();
}

class ElectionsLoaded extends ElectionState {
  final List<ElectionModel> elections;

  const ElectionsLoaded(this.elections);

  @override
  List<Object?> get props => [elections];
}

class ElectionDetailsLoaded extends ElectionState {
  final ElectionModel election;

  const ElectionDetailsLoaded(this.election);

  @override
  List<Object?> get props => [election];
}

class ElectionFailure extends ElectionState {
  final String message;

  const ElectionFailure(this.message);

  @override
  List<Object?> get props => [message];
}
